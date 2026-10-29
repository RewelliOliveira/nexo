import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import { Memory } from "@mastra/memory";
import type { UIMessage } from "ai";
import { z } from "zod";
import type { DecisionLog } from "@/db/schema";
import { createAgentStore } from "@/mastra/agent-store";
import { getConversationService, getDecisionLogService } from "@/services/conversations";
import { DECISION_OUTCOMES, type ChatState, type DecisionView } from "./chat-state";

// Reads the agent memory without loading the whole Mastra instance: the
// page and the chat route would each open its observability store otherwise
let historyMemory: Memory | undefined;

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
  historyMemory ??= new Memory({ storage: createAgentStore() });
  const memory = historyMemory;
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
