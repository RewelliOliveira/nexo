import { z } from "zod";
import { getSessionEmployeeId } from "@/lib/session";
import {
  ConversationNotFoundError,
  ConversationStateError,
  getConversationService,
} from "@/services/conversations";

/** Longest message the employee can send to the analyst at once. */
const MAX_MESSAGE_LENGTH = 4000;

const requestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

/**
 * The employee writes to the service desk while the agent is paused. The
 * agent never sees these messages; the analyst reads them in the console.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/chat/[id]/messages">,
): Promise<Response> {
  const employeeId = await getSessionEmployeeId();
  if (!employeeId) {
    return errorResponse(401, "unauthenticated", "Entre com seu e-mail corporativo para conversar.");
  }
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return errorResponse(400, "invalid_request", "Escreva uma mensagem.");
  }

  const { id } = await ctx.params;
  try {
    const message = await getConversationService().sendToServiceDesk(
      employeeId,
      id,
      body.data.text,
    );
    return Response.json({ id: message.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ConversationNotFoundError) {
      return errorResponse(404, "not_found", "Conversa não encontrada.");
    }
    if (error instanceof ConversationStateError) {
      // Given back to the agent or closed meanwhile; the chat refreshes
      return errorResponse(409, "not_with_service_desk", "A conversa não está mais com um analista.", {
        status: error.status,
      });
    }
    throw error;
  }
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): Response {
  return Response.json({ error: { code, message, ...extra } }, { status });
}
