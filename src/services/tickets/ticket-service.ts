import { and, asc, desc, eq, inArray, like } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import {
  conversations,
  ticketUpdates,
  tickets,
  type Ticket,
  type TicketType,
} from "@/db/schema";
import { isSameProblem } from "./duplicates";
import {
  DuplicateTicketError,
  InvalidStateError,
  NotFoundError,
  TicketServiceError,
} from "./errors";
import { ACTIVE_STATUSES, computeDueAt, isActiveStatus, isOverdue } from "./sla";
import {
  createTicketInputSchema,
  handoffInputSchema,
  reopenTicketInputSchema,
  updateTicketInputSchema,
  type CreateTicketInput,
  type HandoffInput,
  type HandoffResult,
  type ListTicketsFilter,
  type ReopenTicketInput,
  type SimilarTickets,
  type SimilarTicketsQuery,
  type TicketDetail,
  type TicketSummary,
  type UpdateTicketInput,
} from "./types";

const DAY = 24 * 60 * 60 * 1000;
export const REOPEN_WINDOW_DAYS = 7;

export type TicketServiceOptions = {
  db: Database;
  now?: () => Date;
};

/**
 * Simulated legacy ticket system. Every operation receives the id of the
 * logged-in employee and only ever reads or writes that employee's records.
 */
export function createTicketService({
  db,
  now = () => new Date(),
}: TicketServiceOptions) {
  function toSummary(ticket: Ticket): TicketSummary {
    return { ...ticket, isOverdue: isOverdue(ticket, now()) };
  }

  async function findOwnedTicket(
    employeeId: string,
    ticketId: string,
  ): Promise<Ticket> {
    const ticket = await db.query.tickets.findFirst({
      where: and(eq(tickets.id, ticketId), eq(tickets.employeeId, employeeId)),
    });
    if (!ticket) throw new NotFoundError("ticket", ticketId);
    return ticket;
  }

  async function getDetail(
    employeeId: string,
    ticketId: string,
  ): Promise<TicketDetail> {
    const ticket = await findOwnedTicket(employeeId, ticketId);
    const updates = await db.query.ticketUpdates.findMany({
      where: eq(ticketUpdates.ticketId, ticket.id),
      orderBy: asc(ticketUpdates.createdAt),
    });
    return { ...toSummary(ticket), updates };
  }

  async function nextTicketId(type: TicketType): Promise<string> {
    const rows = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(like(tickets.id, `${type}-%`));
    const highest = rows.reduce(
      (max, row) => Math.max(max, Number(row.id.slice(type.length + 1)) || 0),
      type === "INC" ? 20000 : 10000,
    );
    return `${type}-${highest + 1}`;
  }

  async function findSimilar(
    employeeId: string,
    query: SimilarTicketsQuery,
  ): Promise<SimilarTickets> {
    const at = now();
    const candidates = await db.query.tickets.findMany({
      where: and(
        eq(tickets.employeeId, employeeId),
        eq(tickets.category, query.category),
      ),
      orderBy: desc(tickets.updatedAt),
    });
    const similar = candidates.filter((ticket) => isSameProblem(query, ticket));

    return {
      active: similar.filter((ticket) => isActiveStatus(ticket.status)).map(toSummary),
      reopenable: similar
        .filter(
          (ticket) =>
            ticket.status === "resolved" &&
            ticket.resolvedAt !== null &&
            canReopen(ticket.resolvedAt, at),
        )
        .map(toSummary),
    };
  }

  return {
    async list(
      employeeId: string,
      filter: ListTicketsFilter = {},
    ): Promise<TicketSummary[]> {
      const scope = filter.scope ?? "active";
      const rows = await db.query.tickets.findMany({
        where: and(
          eq(tickets.employeeId, employeeId),
          scope === "active" ? inArray(tickets.status, ACTIVE_STATUSES) : undefined,
        ),
        orderBy: desc(tickets.updatedAt),
      });
      return rows.map(toSummary);
    },

    get(employeeId: string, ticketId: string): Promise<TicketDetail> {
      return getDetail(employeeId, ticketId);
    },

    /**
     * Tickets of this employee about the same problem: active ones (must be
     * updated instead of duplicated) and recently resolved ones (can be reopened).
     */
    findSimilar,

    /** Creates a ticket, refusing when an active one covers the same problem. */
    async create(
      employeeId: string,
      input: CreateTicketInput,
    ): Promise<TicketDetail> {
      const data = parseInput(createTicketInputSchema, input);
      const { active } = await findSimilar(employeeId, data);
      if (active.length > 0) {
        throw new DuplicateTicketError(active);
      }

      const createdAt = now();
      const id = await nextTicketId(data.type);

      await db.batch([
        db.insert(tickets).values({
          ...data,
          id,
          employeeId,
          status: "open",
          createdAt,
          updatedAt: createdAt,
          dueAt: computeDueAt(data.priority, createdAt),
        }),
        db.insert(ticketUpdates).values({
          ticketId: id,
          authorType: "agent",
          kind: "created",
          content: "Chamado aberto pelo Nexo Assist.",
          createdAt,
        }),
      ]);

      return getDetail(employeeId, id);
    },

    /**
     * Adds information to an active ticket. The deadline is not reset: it is
     * the service desk's response deadline, not the employee's.
     */
    async update(
      employeeId: string,
      ticketId: string,
      input: UpdateTicketInput,
    ): Promise<TicketDetail> {
      const data = parseInput(updateTicketInputSchema, input);
      const ticket = await findOwnedTicket(employeeId, ticketId);
      if (!isActiveStatus(ticket.status)) {
        throw new InvalidStateError(
          `ticket ${ticketId} is ${ticket.status}; reopen it before updating`,
        );
      }

      const updatedAt = now();
      const priorityChanged =
        data.priority !== undefined && data.priority !== ticket.priority;

      await db.batch([
        db
          .update(tickets)
          .set({
            updatedAt,
            ...(priorityChanged && data.priority
              ? {
                  priority: data.priority,
                  // A priority change never pushes an existing deadline further
                  dueAt: new Date(
                    Math.min(
                      ticket.dueAt.getTime(),
                      computeDueAt(data.priority, updatedAt).getTime(),
                    ),
                  ),
                }
              : {}),
          })
          .where(eq(tickets.id, ticket.id)),
        db.insert(ticketUpdates).values({
          ticketId: ticket.id,
          authorType: "employee",
          kind: "comment",
          content: data.comment,
          createdAt: updatedAt,
        }),
      ]);

      return getDetail(employeeId, ticket.id);
    },

    /** Reopens a ticket resolved up to REOPEN_WINDOW_DAYS ago. */
    async reopen(
      employeeId: string,
      ticketId: string,
      input: ReopenTicketInput,
    ): Promise<TicketDetail> {
      const data = parseInput(reopenTicketInputSchema, input);
      const ticket = await findOwnedTicket(employeeId, ticketId);
      const reopenedAt = now();

      if (ticket.status !== "resolved" || !ticket.resolvedAt) {
        throw new InvalidStateError(
          `ticket ${ticketId} is ${ticket.status}; only resolved tickets can be reopened`,
        );
      }
      if (!canReopen(ticket.resolvedAt, reopenedAt)) {
        throw new InvalidStateError(
          `ticket ${ticketId} was resolved more than ${REOPEN_WINDOW_DAYS} days ago; open a new ticket instead`,
        );
      }

      await db.batch([
        db
          .update(tickets)
          .set({
            status: "open",
            resolvedAt: null,
            updatedAt: reopenedAt,
            dueAt: computeDueAt(ticket.priority, reopenedAt),
          })
          .where(eq(tickets.id, ticket.id)),
        db.insert(ticketUpdates).values({
          ticketId: ticket.id,
          authorType: "employee",
          kind: "reopened",
          content: data.reason,
          createdAt: reopenedAt,
        }),
      ]);

      return getDetail(employeeId, ticket.id);
    },

    /**
     * Hands the conversation over to an analyst. From now on the agent must
     * not reply until an analyst releases it.
     */
    async handoff(
      employeeId: string,
      input: HandoffInput,
    ): Promise<HandoffResult> {
      const data = parseInput(handoffInputSchema, input);
      const conversation = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.id, data.conversationId),
          eq(conversations.employeeId, employeeId),
        ),
      });
      if (!conversation) {
        throw new NotFoundError("conversation", data.conversationId);
      }
      if (conversation.status !== "with_agent") {
        throw new InvalidStateError(
          `conversation ${conversation.id} is ${conversation.status}; only conversations with the agent can be handed off`,
        );
      }

      const ticket = data.ticketId
        ? await findOwnedTicket(employeeId, data.ticketId)
        : null;
      const handedOffAt = now();

      const conversationUpdate = db
        .update(conversations)
        .set({
          status: "awaiting_analyst",
          handoffReason: data.reason,
          handoffSummary: data.summary,
          handoffTicketId: ticket?.id ?? null,
          handedOffAt,
          updatedAt: handedOffAt,
        })
        .where(eq(conversations.id, conversation.id));

      if (ticket && isActiveStatus(ticket.status)) {
        await db.batch([
          conversationUpdate,
          db
            .update(tickets)
            .set({ status: "awaiting_analyst", updatedAt: handedOffAt })
            .where(eq(tickets.id, ticket.id)),
          db.insert(ticketUpdates).values({
            ticketId: ticket.id,
            authorType: "system",
            kind: "status_change",
            content: `Conversa transferida para um analista. Resumo: ${data.summary}`,
            createdAt: handedOffAt,
          }),
        ]);
      } else {
        await conversationUpdate;
      }

      const updatedConversation = await db.query.conversations.findFirst({
        where: eq(conversations.id, conversation.id),
      });
      if (!updatedConversation) {
        throw new NotFoundError("conversation", conversation.id);
      }
      const updatedTicket = ticket
        ? await findOwnedTicket(employeeId, ticket.id)
        : null;

      return {
        conversation: updatedConversation,
        ticket: updatedTicket ? toSummary(updatedTicket) : null,
      };
    },
  };
}

export type TicketService = ReturnType<typeof createTicketService>;

export function canReopen(resolvedAt: Date, at: Date): boolean {
  return at.getTime() - resolvedAt.getTime() <= REOPEN_WINDOW_DAYS * DAY;
}

function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new TicketServiceError("invalid_input", z.prettifyError(result.error));
  }
  return result.data;
}
