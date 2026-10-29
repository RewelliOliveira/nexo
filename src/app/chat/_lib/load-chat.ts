import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import type { UIMessage } from "ai";
import { z } from "zod";
import { NEXO_ASSIST_AGENT_ID } from "@/agent/nexo-assist";
import type { DecisionLog } from "@/db/schema";
import { mastra } from "@/mastra";
import { getConversationService, getDecisionLogService } from "@/services/conversations";
import { DECISION_OUTCOMES, type ChatState, type DecisionView } from "./chat-state";

const decisionDetailsSchema = z.object({
  outcome: z.enum(DECISION_OUTCOMES).optional(),
  parentDecisionId: z.string().optional(),
});

/**
 * Status, message count and decision log of a conversation of the logged-in
 * employee. A conversation not started yet is an empty one with the agent.
 * Throws ConversationNotFoundError when it belongs to someone else.
 */
export async function loadChatState(
  employeeId: string,
  conversationId: string,
): Promise<ChatState> {
  const conversations = getConversationService();
  const conversation = await conversations.find(employeeId, conversationId);
  if (!conversation) {
    return { status: "with_agent", employeeMessages: 0, decisions: [] };
  }
  const [employeeMessages, decisions] = await Promise.all([
    conversations.countMessages(conversationId, "employee"),
    getDecisionLogService().listByConversation(conversationId),
  ]);
  return {
    status: conversation.status,
    employeeMessages,
    decisions: decisions.map(toDecisionView),
  };
}

/**
 * Messages of the conversation as the chat renders them, tool calls
 * included, read from the agent memory. Ownership is checked by
 * loadChatState, which callers run first.
 */
export async function loadChatHistory(
  employeeId: string,
  conversationId: string,
): Promise<UIMessage[]> {
  const memory = await mastra.getAgentById(NEXO_ASSIST_AGENT_ID).getMemory();
  if (!memory) return [];
  const thread = await memory.getThreadById({ threadId: conversationId });
  if (!thread || thread.resourceId !== employeeId) return [];
  const { messages } = await memory.recall({
    threadId: conversationId,
    resourceId: employeeId,
    perPage: false,
  });
  return toAISdkMessages(messages, { version: "v7" });
}

function toDecisionView(log: DecisionLog): DecisionView {
  const details = decisionDetailsSchema.safeParse(log.details ?? {});
  return {
    id: log.id,
    parentId: details.data?.parentDecisionId ?? null,
    intent: log.intent,
    action: log.action,
    confidence: log.confidence,
    reason: log.reason,
    outcome: details.data?.outcome ?? null,
  };
}
