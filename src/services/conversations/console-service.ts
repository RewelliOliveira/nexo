import { and, count, desc, eq, gt, inArray, ne, or, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  conversations,
  decisionLogs,
  employees,
  messages,
  type Conversation,
  type ConversationStatus,
  type Employee,
  type Message,
} from "@/db/schema";
import {
  ConversationNotFoundError,
  ConversationStateError,
  listAuthoredMessages,
  type AuthoredMessage,
} from "./conversation-service";

/** How many conversations the console lists, most recent first. */
export const CONSOLE_LIST_LIMIT = 100;

/** Who is acting in the console; their name goes into the system messages. */
export type Analyst = Pick<Employee, "id" | "name">;

export type ConsoleConversation = Conversation & {
  employee: Pick<Employee, "id" | "name" | "department">;
  analystName: string | null;
  lastMessage: Pick<Message, "role" | "content" | "createdAt"> | null;
  /** Employee messages nobody answered yet (after the last agent or analyst reply) */
  unanswered: number;
  /** Confidence of the agent when it handed the conversation off */
  handoffConfidence: number | null;
};

const takeable = inArray(conversations.status, ["with_agent", "awaiting_analyst"]);

/** Taken by this analyst; nobody else can give it back or close it. */
const takenBy = (analyst: Analyst) =>
  and(eq(conversations.status, "with_analyst"), eq(conversations.analystId, analyst.id));

/**
 * Service desk view of every conversation, for analysts only: the caller
 * checks the role. Taking over pauses the agent; the conversation can be
 * given back to it or closed by the analyst who took it.
 */
export function createConsoleService({
  db,
  now = () => new Date(),
}: {
  db: Database;
  now?: () => Date;
}) {
  async function summarize(conversation: Conversation): Promise<ConsoleConversation> {
    const [employee, analyst, lastMessage, lastReply, handoff] = await Promise.all([
      db.query.employees.findFirst({ where: eq(employees.id, conversation.employeeId) }),
      conversation.analystId
        ? db.query.employees.findFirst({ where: eq(employees.id, conversation.analystId) })
        : undefined,
      db.query.messages.findFirst({
        where: and(eq(messages.conversationId, conversation.id), ne(messages.role, "system")),
        orderBy: desc(messages.createdAt),
      }),
      db.query.messages.findFirst({
        where: and(
          eq(messages.conversationId, conversation.id),
          inArray(messages.role, ["agent", "analyst"]),
        ),
        orderBy: desc(messages.createdAt),
      }),
      db.query.decisionLogs.findFirst({
        where: and(
          eq(decisionLogs.conversationId, conversation.id),
          eq(decisionLogs.action, "handoffToAnalyst"),
        ),
        orderBy: desc(decisionLogs.createdAt),
      }),
    ]);
    const [unanswered] = await db
      .select({ total: count() })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversation.id),
          eq(messages.role, "employee"),
          lastReply ? gt(messages.createdAt, lastReply.createdAt) : undefined,
        ),
      );

    return {
      ...conversation,
      employee: {
        id: conversation.employeeId,
        name: employee?.name ?? "Funcionário",
        department: employee?.department ?? "",
      },
      analystName: analyst?.name ?? null,
      lastMessage: lastMessage
        ? { role: lastMessage.role, content: lastMessage.content, createdAt: lastMessage.createdAt }
        : null,
      unanswered: unanswered?.total ?? 0,
      handoffConfidence: conversation.handedOffAt ? (handoff?.confidence ?? null) : null,
    };
  }

  async function load(conversationId: string): Promise<Conversation> {
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });
    if (!conversation) throw new ConversationNotFoundError(conversationId);
    return conversation;
  }

  /**
   * Moves the conversation only if it is still in one of the expected
   * states, so two analysts clicking at once cannot both take it.
   */
  async function transition(
    conversationId: string,
    allowed: SQL | undefined,
    to: Partial<Conversation> & { status: ConversationStatus },
    note: string,
  ): Promise<ConsoleConversation> {
    const at = now();
    const updated = await db
      .update(conversations)
      .set({ ...to, updatedAt: at })
      .where(
        and(eq(conversations.id, conversationId), allowed),
      )
      .returning();
    const conversation = updated[0];
    if (!conversation) {
      const current = await load(conversationId);
      const owner = current.analystId ? ` with ${current.analystId}` : "";
      throw new ConversationStateError(
        conversationId,
        current.status,
        `conversation ${conversationId} is ${current.status}${owner}`,
      );
    }
    await db.insert(messages).values({
      id: crypto.randomUUID(),
      conversationId,
      role: "system",
      content: note,
      outsideAgent: true,
      createdAt: at,
    });
    return summarize(conversation);
  }

  return {
    async list(): Promise<ConsoleConversation[]> {
      const rows = await db.query.conversations.findMany({
        orderBy: desc(conversations.updatedAt),
        limit: CONSOLE_LIST_LIMIT,
      });
      return Promise.all(rows.map(summarize));
    },

    async get(conversationId: string): Promise<ConsoleConversation> {
      return summarize(await load(conversationId));
    },

    async listMessages(conversationId: string): Promise<AuthoredMessage[]> {
      return listAuthoredMessages(db, conversationId);
    },

    /** Pauses the agent: from now on only the analyst answers. */
    async assume(conversationId: string, analyst: Analyst): Promise<ConsoleConversation> {
      return transition(
        conversationId,
        takeable,
        { status: "with_analyst", analystId: analyst.id },
        `${analyst.name} assumiu · agent pausado`,
      );
    },

    /** Answers the employee; only the analyst who took the conversation can. */
    async reply(
      conversationId: string,
      analyst: Analyst,
      content: string,
    ): Promise<AuthoredMessage> {
      const at = now();
      // Touching the conversation first checks, in one statement, that it is
      // still this analyst's
      const updated = await db
        .update(conversations)
        .set({ updatedAt: at })
        .where(and(eq(conversations.id, conversationId), takenBy(analyst)))
        .returning({ id: conversations.id });
      if (updated.length === 0) {
        const current = await load(conversationId);
        throw new ConversationStateError(
          conversationId,
          current.status,
          `conversation ${conversationId} is not taken by ${analyst.id}`,
        );
      }
      const [message] = await db
        .insert(messages)
        .values({
          id: crypto.randomUUID(),
          conversationId,
          role: "analyst",
          content,
          authorId: analyst.id,
          outsideAgent: true,
          createdAt: at,
        })
        .returning();
      return { ...message, authorName: analyst.name };
    },

    /**
     * Gives the conversation back to the agent, which answers again. Works
     * while it waits in the queue or once this analyst has taken it.
     */
    async release(conversationId: string, analyst: Analyst): Promise<ConsoleConversation> {
      return transition(
        conversationId,
        or(eq(conversations.status, "awaiting_analyst"), takenBy(analyst)),
        { status: "with_agent", analystId: null },
        `${analyst.name} devolveu ao agent`,
      );
    },

    async close(conversationId: string, analyst: Analyst): Promise<ConsoleConversation> {
      return transition(
        conversationId,
        takenBy(analyst),
        { status: "closed", closedAt: now() },
        `${analyst.name} encerrou o atendimento`,
      );
    },
  };
}

export type ConsoleService = ReturnType<typeof createConsoleService>;
