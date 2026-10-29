import { and, asc, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { decisionLogs, type DecisionLog } from "@/db/schema";

export type NewDecision = {
  conversationId: string;
  intent: string;
  action: string;
  confidence: number;
  reason: string;
  details?: Record<string, unknown>;
};

/**
 * Audit trail of what the agent understood, what it did, how sure it was and
 * why. Decisions are recorded while a reply is generated and attached to the
 * reply once it is saved.
 */
export function createDecisionLogService({
  db,
  now = () => new Date(),
}: {
  db: Database;
  now?: () => Date;
}) {
  return {
    async record(decision: NewDecision): Promise<DecisionLog> {
      const [log] = await db
        .insert(decisionLogs)
        .values({
          ...decision,
          id: crypto.randomUUID(),
          confidence: Math.min(Math.max(decision.confidence, 0), 1),
          createdAt: now(),
        })
        .returning();
      return log;
    },

    async get(conversationId: string, id: string): Promise<DecisionLog | undefined> {
      return db.query.decisionLogs.findFirst({
        where: and(
          eq(decisionLogs.id, id),
          eq(decisionLogs.conversationId, conversationId),
        ),
      });
    },

    async listByConversation(conversationId: string): Promise<DecisionLog[]> {
      return db.query.decisionLogs.findMany({
        where: eq(decisionLogs.conversationId, conversationId),
        orderBy: asc(decisionLogs.createdAt),
      });
    },

    /** Links the decisions made while generating a reply to that reply. */
    async attachPending(conversationId: string, messageId: string): Promise<void> {
      await db
        .update(decisionLogs)
        .set({ messageId })
        .where(
          and(
            eq(decisionLogs.conversationId, conversationId),
            isNull(decisionLogs.messageId),
          ),
        );
    },
  };
}

export type DecisionLogService = ReturnType<typeof createDecisionLogService>;
