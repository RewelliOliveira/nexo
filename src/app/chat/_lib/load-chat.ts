import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import { Memory } from "@mastra/memory";
import type { UIMessage } from "ai";
import { createAgentStore } from "@/mastra/agent-store";
import { getConversationService, getDecisionLogService } from "@/services/conversations";
import { EMPTY_CHAT_STATE, type ChatState } from "./chat-state";
import { withCreatedAt } from "./chat-timeline";
import { toDecisionView } from "./decision-view";

// Reads the agent memory without loading the whole Mastra instance: the
// page and the chat route would each open its observability store otherwise
let historyMemory: Memory | undefined;

/**
 * Status, message count, decision log and service desk messages of a
 * conversation of the logged-in employee. A conversation not started yet is
 * an empty one with the agent. Throws ConversationNotFoundError when it
 * belongs to someone else.
 */
export async function loadChatState(
  employeeId: string,
  conversationId: string,
): Promise<ChatState> {
  const conversations = getConversationService();
  const conversation = await conversations.find(employeeId, conversationId);
  if (!conversation) return EMPTY_CHAT_STATE;
  const [employeeMessages, decisions, serviceDesk, typingAnalyst] = await Promise.all([
    conversations.countMessages(conversationId, "employee"),
    getDecisionLogService().listByConversation(conversationId),
    conversations.listOutsideAgent(conversationId),
    conversations.findTypingAnalyst(conversation),
  ]);
  return {
    status: conversation.status,
    employeeMessages,
    decisions: decisions.map(toDecisionView),
    serviceDesk: serviceDesk.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      authorName: message.authorName,
      createdAt: message.createdAt.toISOString(),
    })),
    typingAnalyst,
  };
}

/**
 * Messages of the conversation as the chat renders them, tool calls
 * included, read from the agent memory. Each carries when it was written,
 * so the service desk messages can be placed among them. Ownership is
 * checked by loadChatState, which callers run first.
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
  const writtenAt = new Map(messages.map((message) => [message.id, message.createdAt]));
  return toAISdkMessages(messages, { version: "v7" }).map((message) => {
    const createdAt = writtenAt.get(message.id);
    return createdAt ? withCreatedAt(message, new Date(createdAt)) : message;
  });
}
