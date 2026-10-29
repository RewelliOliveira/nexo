import { and, count, desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  conversations,
  messages,
  type Conversation,
  type Message,
} from "@/db/schema";

export type MessageRole = Message["role"];

/**
 * Thrown both when the conversation does not exist and when it belongs to
 * another employee, so callers cannot probe for other people's conversations.
 */
export class ConversationNotFoundError extends Error {
  constructor(readonly conversationId: string) {
    super(`conversation ${conversationId} not found`);
    this.name = "ConversationNotFoundError";
  }
}

export type ConversationServiceOptions = {
  db: Database;
  now?: () => Date;
};

/** Conversations and their messages, always scoped to the logged-in employee. */
export function createConversationService({
  db,
  now = () => new Date(),
}: ConversationServiceOptions) {
  async function find(
    employeeId: string,
    conversationId: string,
  ): Promise<Conversation | undefined> {
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });
    if (conversation && conversation.employeeId !== employeeId) {
      throw new ConversationNotFoundError(conversationId);
    }
    return conversation;
  }

  return {
    /** The conversation, or undefined when it was not started yet. */
    find,

    /** Most recently active conversation of the employee, to resume it. */
    async findLatest(employeeId: string): Promise<Conversation | undefined> {
      return db.query.conversations.findFirst({
        where: eq(conversations.employeeId, employeeId),
        orderBy: desc(conversations.updatedAt),
      });
    },

    async get(employeeId: string, conversationId: string): Promise<Conversation> {
      const conversation = await find(employeeId, conversationId);
      if (!conversation) throw new ConversationNotFoundError(conversationId);
      return conversation;
    },

    /** Returns the conversation, starting it with the agent on first use. */
    async getOrCreate(
      employeeId: string,
      conversationId: string,
    ): Promise<Conversation> {
      const existing = await find(employeeId, conversationId);
      if (existing) return existing;

      const createdAt = now();
      const [created] = await db
        .insert(conversations)
        .values({
          id: conversationId,
          employeeId,
          status: "with_agent",
          createdAt,
          updatedAt: createdAt,
        })
        .returning();
      return created;
    },

    async addMessage(
      conversationId: string,
      role: MessageRole,
      content: string,
    ): Promise<Message> {
      const createdAt = now();
      const [message] = await db
        .insert(messages)
        .values({ id: crypto.randomUUID(), conversationId, role, content, createdAt })
        .returning();
      await db
        .update(conversations)
        .set({ updatedAt: createdAt })
        .where(eq(conversations.id, conversationId));
      return message;
    },

    async countMessages(conversationId: string, role: MessageRole): Promise<number> {
      const [row] = await db
        .select({ total: count() })
        .from(messages)
        .where(
          and(eq(messages.conversationId, conversationId), eq(messages.role, role)),
        );
      return row?.total ?? 0;
    },
  };
}

export type ConversationService = ReturnType<typeof createConversationService>;
