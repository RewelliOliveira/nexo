import { and, asc, count, desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  conversations,
  employees,
  messages,
  type Conversation,
  type ConversationStatus,
  type Message,
} from "@/db/schema";

export type MessageRole = Message["role"];

/** A message with the name of the analyst who wrote it, if any. */
export type AuthoredMessage = Message & { authorName: string | null };

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

/** The action does not fit the current state, e.g. taking a closed conversation. */
export class ConversationStateError extends Error {
  constructor(
    readonly conversationId: string,
    readonly status: ConversationStatus,
    message: string,
  ) {
    super(message);
    this.name = "ConversationStateError";
  }
}

/** While here the employee talks to the service desk instead of the agent. */
const WITH_SERVICE_DESK: readonly ConversationStatus[] = ["awaiting_analyst", "with_analyst"];

/** Messages with the name of their author, oldest first. */
export async function listAuthoredMessages(
  db: Database,
  conversationId: string,
  { outsideAgentOnly = false }: { outsideAgentOnly?: boolean } = {},
): Promise<AuthoredMessage[]> {
  const rows = await db
    .select({ message: messages, authorName: employees.name })
    .from(messages)
    .leftJoin(employees, eq(messages.authorId, employees.id))
    .where(
      and(
        eq(messages.conversationId, conversationId),
        outsideAgentOnly ? eq(messages.outsideAgent, true) : undefined,
      ),
    )
    .orderBy(asc(messages.createdAt));
  return rows.map(({ message, authorName }) => ({ ...message, authorName }));
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

  async function addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    { outsideAgent = false }: { outsideAgent?: boolean } = {},
  ): Promise<Message> {
    const createdAt = now();
    const [message] = await db
      .insert(messages)
      .values({ id: crypto.randomUUID(), conversationId, role, content, outsideAgent, createdAt })
      .returning();
    await db
      .update(conversations)
      .set({ updatedAt: createdAt })
      .where(eq(conversations.id, conversationId));
    return message;
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

    /** outsideAgent marks messages the agent memory does not have. */
    addMessage,

    /**
     * The employee writes to the analyst while the agent is paused. Throws
     * ConversationStateError when the conversation left the service desk
     * meanwhile, e.g. it was given back to the agent or closed.
     */
    async sendToServiceDesk(
      employeeId: string,
      conversationId: string,
      content: string,
    ): Promise<Message> {
      const conversation = await find(employeeId, conversationId);
      if (!conversation) throw new ConversationNotFoundError(conversationId);
      if (!WITH_SERVICE_DESK.includes(conversation.status)) {
        throw new ConversationStateError(
          conversationId,
          conversation.status,
          `conversation ${conversationId} is ${conversation.status}`,
        );
      }
      return addMessage(conversationId, "employee", content, { outsideAgent: true });
    },

    /**
     * What the chat shows besides the agent memory: the messages exchanged
     * with the service desk and its notes. Ownership is checked by the caller.
     */
    async listOutsideAgent(conversationId: string): Promise<AuthoredMessage[]> {
      return listAuthoredMessages(db, conversationId, { outsideAgentOnly: true });
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
