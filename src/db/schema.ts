import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import {
  CONVERSATION_STATUSES,
  EMPLOYEE_ROLES,
  MESSAGE_ROLES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  TICKET_UPDATE_AUTHORS,
  TICKET_UPDATE_KINDS,
} from "@/lib/domain";

export * from "@/lib/domain";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  department: text("department").notNull(),
  role: text("role", { enum: EMPLOYEE_ROLES }).notNull().default("employee"),
  createdAt: createdAt(),
});

export const kbArticles = sqliteTable("kb_articles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category", { enum: TICKET_CATEGORIES }).notNull(),
  content: text("content").notNull(),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
  createdAt: createdAt(),
});

export const tickets = sqliteTable(
  "tickets",
  {
    // Human-readable code, e.g. INC-20311 or REQ-10442
    id: text("id").primaryKey(),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id),
    type: text("type", { enum: TICKET_TYPES }).notNull(),
    category: text("category", { enum: TICKET_CATEGORIES }).notNull(),
    priority: text("priority", { enum: TICKET_PRIORITIES }).notNull(),
    status: text("status", { enum: TICKET_STATUSES }).notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    // Who is affected (e.g. "only me", "finance team")
    affected: text("affected").notNull(),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    // Deadline for the next response from the service desk (SLA)
    dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("tickets_employee_idx").on(table.employeeId)],
);

export const ticketUpdates = sqliteTable(
  "ticket_updates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id),
    authorType: text("author_type", { enum: TICKET_UPDATE_AUTHORS }).notNull(),
    kind: text("kind", { enum: TICKET_UPDATE_KINDS }).notNull(),
    content: text("content").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("ticket_updates_ticket_idx").on(table.ticketId)],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id),
    status: text("status", { enum: CONVERSATION_STATUSES })
      .notNull()
      .default("with_agent"),
    analystId: text("analyst_id").references(() => employees.id),
    // Filled when the conversation is handed off to an analyst
    handoffReason: text("handoff_reason"),
    handoffSummary: text("handoff_summary"),
    handoffTicketId: text("handoff_ticket_id").references(() => tickets.id),
    handedOffAt: integer("handed_off_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("conversations_employee_idx").on(table.employeeId),
    index("conversations_status_idx").on(table.status),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    role: text("role", { enum: MESSAGE_ROLES }).notNull(),
    content: text("content").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("messages_conversation_idx").on(table.conversationId)],
);

export const decisionLogs = sqliteTable(
  "decision_logs",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    // Agent reply this decision belongs to; null while the reply is being generated
    messageId: text("message_id").references(() => messages.id),
    intent: text("intent").notNull(),
    action: text("action").notNull(),
    confidence: real("confidence").notNull(),
    reason: text("reason").notNull(),
    // Structured extra data (tool input/output, ticket id, ...)
    details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (table) => [index("decision_logs_conversation_idx").on(table.conversationId)],
);

export type Employee = typeof employees.$inferSelect;
export type KbArticle = typeof kbArticles.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type TicketUpdate = typeof ticketUpdates.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type DecisionLog = typeof decisionLogs.$inferSelect;
