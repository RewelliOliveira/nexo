import { z } from "zod";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_TYPES,
  type Conversation,
  type Ticket,
  type TicketCategory,
  type TicketUpdate,
} from "@/db/schema";

export const HANDOFF_REASONS = [
  "employee_request",
  "critical",
  "overdue",
  "low_confidence",
] as const;

export const createTicketInputSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(10).max(4000),
  type: z.enum(TICKET_TYPES),
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES),
  affected: z.string().trim().min(2).max(200),
});

export const updateTicketInputSchema = z.object({
  comment: z.string().trim().min(3).max(4000),
  priority: z.enum(TICKET_PRIORITIES).optional(),
});

export const reopenTicketInputSchema = z.object({
  reason: z.string().trim().min(3).max(4000),
});

export const handoffInputSchema = z.object({
  conversationId: z.string().min(1),
  reason: z.enum(HANDOFF_REASONS),
  summary: z.string().trim().min(10).max(4000),
  ticketId: z.string().min(1).optional(),
});

export type CreateTicketInput = z.input<typeof createTicketInputSchema>;
export type UpdateTicketInput = z.input<typeof updateTicketInputSchema>;
export type ReopenTicketInput = z.input<typeof reopenTicketInputSchema>;
export type HandoffInput = z.input<typeof handoffInputSchema>;
export type HandoffReason = (typeof HANDOFF_REASONS)[number];

export type TicketSummary = Ticket & { isOverdue: boolean };
export type TicketDetail = TicketSummary & { updates: TicketUpdate[] };

export type ListTicketsFilter = {
  /** "active" (default) returns only tickets still being worked on */
  scope?: "active" | "all";
};

export type SimilarTicketsQuery = {
  title: string;
  category: TicketCategory;
};

export type SimilarTickets = {
  active: TicketSummary[];
  reopenable: TicketSummary[];
};

export type HandoffResult = {
  conversation: Conversation;
  ticket: TicketSummary | null;
};
