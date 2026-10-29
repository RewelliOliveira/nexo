import { z } from "zod";
import {
  CONVERSATION_STATUSES,
  HANDOFF_REASONS,
  MESSAGE_ROLES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
} from "@/lib/domain";
import { decisionViewSchema } from "../../chat/_lib/chat-state";

// Shapes the console receives from the server, parsed in the browser.
// Dates travel as ISO strings.

export const conversationItemSchema = z.object({
  id: z.string(),
  status: z.enum(CONVERSATION_STATUSES),
  employee: z.object({ id: z.string(), name: z.string(), department: z.string() }),
  analystId: z.string().nullable(),
  analystName: z.string().nullable(),
  lastMessage: z
    .object({ role: z.enum(MESSAGE_ROLES), content: z.string(), createdAt: z.iso.datetime() })
    .nullable(),
  /** Employee messages nobody answered yet */
  unanswered: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
  handoffReason: z.enum(HANDOFF_REASONS).nullable(),
  handoffSummary: z.string().nullable(),
  handoffTicketId: z.string().nullable(),
  handoffConfidence: z.number().nullable(),
  handedOffAt: z.iso.datetime().nullable(),
});

export const consoleListSchema = z.object({
  conversations: z.array(conversationItemSchema),
});

export const historyMessageSchema = z.object({
  id: z.string(),
  role: z.enum(MESSAGE_ROLES),
  content: z.string(),
  createdAt: z.iso.datetime(),
  /** What the agent decided while writing this reply */
  decisions: z.array(decisionViewSchema),
});

export const consoleTicketSchema = z.object({
  id: z.string(),
  type: z.enum(TICKET_TYPES),
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES),
  status: z.enum(TICKET_STATUSES),
  title: z.string(),
  isOverdue: z.boolean(),
  updatedAt: z.iso.datetime(),
  dueAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});

export const conversationDetailSchema = z.object({
  conversation: conversationItemSchema,
  messages: z.array(historyMessageSchema),
  /** Decisions of a reply still being written */
  pendingDecisions: z.array(decisionViewSchema),
  /** Null when the legacy ticket system stayed down after the retries */
  tickets: z.array(consoleTicketSchema).nullable(),
});

export type ConversationItem = z.infer<typeof conversationItemSchema>;
export type HistoryMessage = z.infer<typeof historyMessageSchema>;
export type ConsoleTicket = z.infer<typeof consoleTicketSchema>;
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;

/** Error body of the console API and actions. */
export type ConsoleError = { code: string; message: string };
