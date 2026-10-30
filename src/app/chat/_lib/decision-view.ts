import { z } from "zod";
import type { DecisionLog } from "@/db/schema";
import { DECISION_OUTCOMES, type DecisionView } from "./chat-state";

const decisionDetailsSchema = z.object({
  outcome: z.enum(DECISION_OUTCOMES).optional(),
  parentDecisionId: z.string().optional(),
});

/** A recorded decision as the chat and the console show it. */
export function toDecisionView(log: DecisionLog): DecisionView {
  const details = decisionDetailsSchema.safeParse(log.details ?? {});
  return {
    id: log.id,
    parentId: details.data?.parentDecisionId ?? null,
    intent: log.intent,
    action: log.action,
    confidence: log.confidence,
    reason: log.reason,
    outcome: details.data?.outcome ?? null,
  };
}
