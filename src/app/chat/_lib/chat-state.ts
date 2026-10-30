import { z } from "zod";
import { CONVERSATION_STATUSES, MESSAGE_ROLES } from "@/lib/domain";

// Shapes the chat page receives from the server, parsed in the browser

export const DECISION_OUTCOMES = ["success", "rejected", "failed"] as const;

export const decisionViewSchema = z.object({
  id: z.string(),
  /** Call this decision was taken inside of, e.g. the automatic handoff */
  parentId: z.string().nullable(),
  intent: z.string(),
  action: z.string(),
  confidence: z.number(),
  reason: z.string(),
  outcome: z.enum(DECISION_OUTCOMES).nullable(),
});

/** A message exchanged with the service desk, or one of its notes. */
export const serviceDeskMessageSchema = z.object({
  id: z.string(),
  role: z.enum(MESSAGE_ROLES),
  content: z.string(),
  /** Analyst who wrote it */
  authorName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const chatStateSchema = z.object({
  status: z.enum(CONVERSATION_STATUSES),
  /** Messages the employee sent in this session, counted against the limit */
  employeeMessages: z.number().int().nonnegative(),
  decisions: z.array(decisionViewSchema),
  /** What happened outside the agent memory, merged into the chat by time */
  serviceDesk: z.array(serviceDeskMessageSchema),
  /** Analyst writing a reply right now */
  typingAnalyst: z.string().nullable(),
});

/** Chat of a conversation not started yet. */
export const EMPTY_CHAT_STATE: ChatState = {
  status: "with_agent",
  employeeMessages: 0,
  decisions: [],
  serviceDesk: [],
  typingAnalyst: null,
};

export type DecisionView = z.infer<typeof decisionViewSchema>;
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];
export type ChatState = z.infer<typeof chatStateSchema>;
export type ServiceDeskMessage = z.infer<typeof serviceDeskMessageSchema>;

/** Error body of the chat API, e.g. when the agent is paused. */
export const chatErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    status: z.enum(CONVERSATION_STATUSES).optional(),
  }),
});

export type ChatError = z.infer<typeof chatErrorSchema>["error"];
