// Domain values shared by the database, the services and the browser. Kept
// apart from the Drizzle schema so client code can import them.

export const EMPLOYEE_ROLES = ["employee", "analyst"] as const;
export const TICKET_TYPES = ["INC", "REQ"] as const;
export const TICKET_CATEGORIES = [
  "access",
  "network_vpn",
  "hardware",
  "software",
  "email",
  "other",
] as const;
export const TICKET_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "awaiting_analyst",
  "approved",
  "resolved",
  "closed",
] as const;
export const TICKET_UPDATE_AUTHORS = [
  "employee",
  "agent",
  "analyst",
  "system",
] as const;
export const TICKET_UPDATE_KINDS = [
  "created",
  "comment",
  "status_change",
  "reopened",
] as const;
export const CONVERSATION_STATUSES = [
  "with_agent",
  "awaiting_analyst",
  "with_analyst",
  "closed",
] as const;
export const MESSAGE_ROLES = ["employee", "agent", "analyst", "system"] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];
export type TicketType = (typeof TICKET_TYPES)[number];
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];
