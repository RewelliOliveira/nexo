import { z } from "zod";
import { CONVERSATION_STATUSES } from "@/lib/domain";

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

export const chatStateSchema = z.object({
  status: z.enum(CONVERSATION_STATUSES),
  /** Messages the employee sent in this session, counted against the limit */
  employeeMessages: z.number().int().nonnegative(),
  decisions: z.array(decisionViewSchema),
});

export type DecisionView = z.infer<typeof decisionViewSchema>;
export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];
export type ChatState = z.infer<typeof chatStateSchema>;

/** Error body of the chat API, e.g. when the agent is paused. */
export const chatErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    status: z.enum(CONVERSATION_STATUSES).optional(),
  }),
});

export type ChatError = z.infer<typeof chatErrorSchema>["error"];
