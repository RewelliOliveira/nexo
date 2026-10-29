import { handleChatStream } from "@mastra/ai-sdk";
import {
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
  RequestContext,
} from "@mastra/core/request-context";
import { createUIMessageStreamResponse, validateUIMessages, type UIMessage } from "ai";
import { z } from "zod";
import { NEXO_ASSIST_AGENT_ID } from "@/agent/nexo-assist";
import { getSessionEmployeeId } from "@/lib/session";
import { mastra } from "@/mastra";
import {
  ConversationNotFoundError,
  getConversationService,
  getDecisionLogService,
} from "@/services/conversations";
import { prepareChatTurn } from "./prepare-turn";

const requestSchema = z.object({
  // useChat sends the chat id as `id`; it is the conversation id
  id: z.string().trim().min(1).max(100),
  messages: z.array(z.unknown()).min(1),
});

const PAUSED_MESSAGE = {
  awaiting_analyst:
    "Sua conversa foi transferida para um analista. Ele vai responder por aqui em breve.",
  with_analyst: "Um analista está cuidando da sua conversa e vai responder por aqui.",
  closed: "Esta conversa foi encerrada. Comece uma nova conversa para falar com o Nexo Assist.",
} as const;

/** Streams Nexo Assist's reply in the AI SDK UI format. */
export async function POST(request: Request): Promise<Response> {
  const employeeId = await getSessionEmployeeId();
  if (!employeeId) {
    return errorResponse(401, "unauthenticated", "Entre com seu e-mail corporativo para conversar.");
  }

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return errorResponse(400, "invalid_request", "Mensagem inválida.");
  }
  const conversationId = body.data.id;

  let lastMessage: UIMessage;
  try {
    const messages = await validateUIMessages({ messages: body.data.messages });
    const last = messages.at(-1);
    if (!last || last.role !== "user") throw new Error("last message must be from the user");
    lastMessage = last;
  } catch {
    return errorResponse(400, "invalid_request", "Mensagem inválida.");
  }

  const text = lastMessage.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n")
    .trim();
  if (!text) {
    return errorResponse(400, "invalid_request", "Escreva uma mensagem.");
  }

  const conversations = getConversationService();
  let turn;
  try {
    turn = await prepareChatTurn(conversations, { employeeId, conversationId, text });
  } catch (error) {
    if (error instanceof ConversationNotFoundError) {
      return errorResponse(404, "not_found", "Conversa não encontrada.");
    }
    throw error;
  }

  if (turn.kind === "paused") {
    return errorResponse(409, "agent_paused", PAUSED_MESSAGE[turn.status], {
      status: turn.status,
    });
  }
  if (turn.kind === "limit_reached") {
    return errorResponse(
      429,
      "message_limit",
      "Você atingiu o limite de 30 mensagens desta conversa. Comece uma nova conversa para continuar.",
    );
  }

  // Identity is pinned server-side: tools read it here, and Mastra memory
  // refuses threads that do not belong to this resource
  const requestContext = new RequestContext();
  requestContext.set("employeeId", employeeId);
  requestContext.set("conversationId", conversationId);
  requestContext.set(MASTRA_RESOURCE_ID_KEY, employeeId);
  requestContext.set(MASTRA_THREAD_ID_KEY, conversationId);

  let stream: Awaited<ReturnType<typeof handleChatStream>>;
  try {
    stream = await handleChatStream({
      mastra,
      agentId: NEXO_ASSIST_AGENT_ID,
      version: "v7",
      params: {
        // History comes from memory; only the new message is trusted from the client
        messages: [lastMessage],
        requestContext,
        memory: { thread: conversationId, resource: employeeId },
        onFinish: async ({ text: reply }) => {
          if (!reply.trim()) return;
          const message = await conversations.addMessage(conversationId, "agent", reply);
          await getDecisionLogService().attachPending(conversationId, message.id);
        },
      },
      onError: (error) => {
        console.error("[chat] agent stream failed", error);
        return "Não consegui responder agora. Tente novamente em instantes.";
      },
    });
  } catch (error) {
    // The agent did not even start; the employee's message is kept for a retry
    console.error("[chat] agent could not start", error);
    return errorResponse(
      503,
      "agent_unavailable",
      "Não consegui responder agora. Tente novamente em instantes.",
    );
  }

  return createUIMessageStreamResponse({ stream });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): Response {
  return Response.json({ error: { code, message, ...extra } }, { status });
}
