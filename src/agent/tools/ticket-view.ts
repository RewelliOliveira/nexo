import { z } from "zod";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
} from "@/lib/domain";
import type { TicketDetail, TicketSummary } from "@/services/tickets";

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Brasília time, ready to show; saves the model from timezone math. */
export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}

const FORMATTED_DATE_TIME = /^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2})$/;

/**
 * Reads back a date written by formatDateTime, e.g. for the chat to show a
 * tool result. Brasília has had no daylight saving time since 2019.
 */
export function parseDateTime(value: string): Date | null {
  const match = FORMATTED_DATE_TIME.exec(value.trim());
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Compact ticket shape for the model: fewer tokens and no internal fields
export const ticketViewSchema = z.object({
  id: z.string(),
  type: z.enum(TICKET_TYPES),
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES),
  status: z.enum(TICKET_STATUSES),
  title: z.string(),
  affected: z.string(),
  isOverdue: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  dueAt: z.string(),
  resolvedAt: z.string().nullable(),
});

export const ticketDetailViewSchema = ticketViewSchema.extend({
  description: z.string(),
  updates: z.array(
    z.object({ author: z.string(), kind: z.string(), content: z.string(), at: z.string() }),
  ),
});

export type TicketView = z.infer<typeof ticketViewSchema>;
export type TicketDetailView = z.infer<typeof ticketDetailViewSchema>;

export function toTicketView(ticket: TicketSummary): TicketView {
  return {
    id: ticket.id,
    type: ticket.type,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    title: ticket.title,
    affected: ticket.affected,
    isOverdue: ticket.isOverdue,
    createdAt: formatDateTime(ticket.createdAt),
    updatedAt: formatDateTime(ticket.updatedAt),
    dueAt: formatDateTime(ticket.dueAt),
    resolvedAt: ticket.resolvedAt ? formatDateTime(ticket.resolvedAt) : null,
  };
}

export function toTicketDetailView(ticket: TicketDetail): TicketDetailView {
  return {
    ...toTicketView(ticket),
    description: ticket.description,
    updates: ticket.updates.map((update) => ({
      author: update.authorType,
      kind: update.kind,
      content: update.content,
      at: formatDateTime(update.createdAt),
    })),
  };
}
