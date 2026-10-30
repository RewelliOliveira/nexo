import type { ConversationStatus } from "@/db/schema";
import type { ConversationService } from "@/services/conversations";

/** Annex A: each chat session accepts up to 30 employee messages. */
export const MAX_EMPLOYEE_MESSAGES = 30;

/**
 * Starting a new conversation resets the limit above, and the login accepts
 * any password, so this is what bounds the model cost of a public deploy.
 */
export const MAX_DAILY_EMPLOYEE_MESSAGES = 100;

/** Longest message the employee can send at once, to the agent or an analyst. */
export const MAX_MESSAGE_LENGTH = 4000;

const DAY = 24 * 60 * 60 * 1000;

export type ChatTurn =
  | { kind: "agent" }
  /** Taken over by an analyst or closed: the agent must stay silent */
  | { kind: "paused"; status: Exclude<ConversationStatus, "with_agent"> }
  | { kind: "limit_reached" }
  | { kind: "daily_limit_reached" };

/**
 * Decides whether the agent may answer this message. The employee's message
 * is always stored, so an analyst sees it even while the agent is paused;
 * then it stays out of the agent memory and the chat reads it from the database.
 */
export async function prepareChatTurn(
  conversations: ConversationService,
  { employeeId, conversationId, text }: {
    employeeId: string;
    conversationId: string;
    text: string;
  },
): Promise<ChatTurn> {
  const conversation = await conversations.getOrCreate(employeeId, conversationId);
  if (conversation.status !== "with_agent") {
    await conversations.addMessage(conversationId, "employee", text, { outsideAgent: true });
    return { kind: "paused", status: conversation.status };
  }

  const sent = await conversations.countMessages(conversationId, "employee");
  if (sent >= MAX_EMPLOYEE_MESSAGES) {
    return { kind: "limit_reached" };
  }

  const sentToday = await conversations.countSentToAgentSince(
    employeeId,
    new Date(Date.now() - DAY),
  );
  if (sentToday >= MAX_DAILY_EMPLOYEE_MESSAGES) {
    return { kind: "daily_limit_reached" };
  }

  await conversations.addMessage(conversationId, "employee", text);
  return { kind: "agent" };
}
