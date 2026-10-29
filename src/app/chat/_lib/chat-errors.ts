import { chatErrorSchema } from "./chat-state";

export type ChatFailure =
  /** The conversation state already explains it (transferred, limit) */
  | { kind: "explained" }
  | { kind: "signed_out"; message: string }
  | { kind: "retry"; title: string; message: string };

// Refusals the status notice covers once the state is refreshed
const EXPLAINED_CODES = new Set(["agent_paused", "message_limit"]);

const GENERIC_MESSAGE = "Não consegui responder agora. Tente novamente em instantes.";

/**
 * What to tell the employee when a message fails. The chat API answers
 * refusals as JSON, which the transport puts in the error message; stream
 * errors carry the text the route chose.
 */
export function describeChatError(error: Error): ChatFailure {
  const body = parseJson(error.message);
  const parsed = chatErrorSchema.safeParse(body);
  if (parsed.success) {
    const { code, message } = parsed.data.error;
    if (EXPLAINED_CODES.has(code)) return { kind: "explained" };
    if (code === "unauthenticated") return { kind: "signed_out", message };
    return { kind: "retry", title: "Não consegui enviar sua mensagem", message };
  }
  // fetch rejects with a TypeError only when the request never reached the server
  if (error instanceof TypeError) {
    return {
      kind: "retry",
      title: "Sem conexão com o Nexo Assist",
      message: "Verifique sua internet e tente de novo. Sua mensagem não foi perdida.",
    };
  }
  // Text written by the route for the employee, or an unexpected failure
  const readable =
    body === undefined &&
    error.message.length < 200 &&
    !/[{}<]|failed to fetch/i.test(error.message);
  return {
    kind: "retry",
    title: "Não consegui responder",
    message: readable ? error.message : GENERIC_MESSAGE,
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
