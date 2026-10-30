import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { NewDecision } from "@/services/conversations";
import type { TicketService } from "@/services/tickets";
import { nexoRequestContextSchema } from "../request-context";
import { withRetry } from "../retry";
import type { AgentServices } from "../services";
import { toToolError, ToolRejection, toolErrorSchema } from "./tool-errors";

/** Fields every tool asks the model for, so each call explains itself. */
export const decisionFields = {
  intent: z
    .string()
    .trim()
    .min(3)
    .max(300)
    .describe("O que você entendeu que o funcionário quer, em uma frase curta"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Sua segurança de que esta é a ação certa agora, de 0 a 1"),
  reason: z
    .string()
    .trim()
    .min(3)
    .max(500)
    .describe("Por que você escolheu esta ação, em uma frase curta"),
};

export const confirmationField = {
  confirmed: z
    .boolean()
    .describe(
      "true somente se o funcionário confirmou explicitamente esta ação depois de ver o que será feito",
    ),
};

type DecisionInput = {
  intent: string;
  confidence: number;
  reason: string;
  confirmed?: boolean;
};

export type NexoToolContext = {
  employeeId: string;
  conversationId: string;
  /** Id the decision log of this call will get; lets drafts be referenced */
  decisionId: string;
  services: AgentServices;
  /** When the employee last wrote, according to the conversation memory */
  lastEmployeeMessageAt: Date | undefined;
  /** Calls the legacy ticket system, retrying while it is down */
  callTickets<T>(operation: (tickets: TicketService) => Promise<T>): Promise<T>;
  /** Records an extra decision taken by the system inside this call, linked to it */
  recordDecision(decision: Omit<NewDecision, "conversationId">): Promise<void>;
};

export type NexoToolDefinition<
  TInput extends z.ZodType<DecisionInput>,
  TOutput extends z.ZodType,
> = {
  id: string;
  description: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  /** Changes data: refused unless the model sends `confirmed: true` */
  requiresConfirmation?: boolean;
  /** Refused below this confidence; the agent should hand off instead */
  minConfidence?: number;
  run(input: z.output<TInput>, context: NexoToolContext): Promise<z.output<TOutput>>;
};

const lastUserMessageSchema = z.object({
  role: z.literal("user"),
  createdAt: z.coerce.date(),
});

/** Latest employee message among the agent's messages (shape owned by Mastra). */
export function findLastEmployeeMessageAt(messages: readonly unknown[]): Date | undefined {
  let last: Date | undefined;
  for (const message of messages) {
    const parsed = lastUserMessageSchema.safeParse(message);
    if (parsed.success && (!last || parsed.data.createdAt > last)) {
      last = parsed.data.createdAt;
    }
  }
  return last;
}

/**
 * Builds a Mastra tool that enforces the service desk rules in code:
 * identity comes from the request context, mutations need confirmation and
 * enough confidence, the legacy system is retried and every call — successful
 * or not — leaves a decision log.
 */
export function defineNexoTool<
  TInput extends z.ZodType<DecisionInput>,
  TOutput extends z.ZodType,
>(services: AgentServices, definition: NexoToolDefinition<TInput, TOutput>) {
  return createTool({
    id: definition.id,
    description: definition.description,
    inputSchema: definition.inputSchema,
    // decisionId points to the decision log of the call (null when the call
    // was refused before one could be recorded); the chat UI shows it
    outputSchema: z.discriminatedUnion("ok", [
      z.object({ ok: z.literal(true), data: definition.outputSchema, decisionId: z.string() }),
      z.object({
        ok: z.literal(false),
        error: toolErrorSchema,
        decisionId: z.string().nullable(),
      }),
    ]),
    execute: async (rawInput, toolContext) => {
      // Mastra already validated the input; parsing again gives us its zod type
      const parsedInput = definition.inputSchema.safeParse(rawInput);
      if (!parsedInput.success) {
        return {
          ok: false as const,
          error: { code: "invalid_input", message: z.prettifyError(parsedInput.error) },
          decisionId: null,
        };
      }
      const input = parsedInput.data;

      const identity = nexoRequestContextSchema.safeParse({
        employeeId: toolContext.requestContext?.get("employeeId"),
        conversationId:
          toolContext.requestContext?.get("conversationId") ??
          toolContext.agent?.threadId,
      });
      if (!identity.success || !identity.data.conversationId) {
        return {
          ok: false as const,
          error: {
            code: "unauthenticated",
            message:
              "Não foi possível identificar o funcionário desta conversa. Peça para ele entrar novamente.",
          },
          decisionId: null,
        };
      }

      const { employeeId } = identity.data;
      const conversationId = identity.data.conversationId;
      try {
        // Checks the conversation belongs to this employee before logging to it
        await services.conversations.getOrCreate(employeeId, conversationId);
      } catch (error) {
        return { ok: false as const, error: toToolError(error), decisionId: null };
      }

      const { intent, confidence, reason, ...args } = input;
      const decisionId = crypto.randomUUID();
      const agentMessages =
        toolContext.agent?.getMessages?.() ?? toolContext.agent?.messages ?? [];

      const context: NexoToolContext = {
        employeeId,
        conversationId,
        decisionId,
        services,
        lastEmployeeMessageAt: findLastEmployeeMessageAt(agentMessages),
        callTickets: (operation) =>
          withRetry(() => operation(services.tickets), services.retry),
        recordDecision: async (decision) => {
          await safeRecord(services, {
            ...decision,
            conversationId,
            details: { ...decision.details, parentDecisionId: decisionId },
          });
        },
      };

      const log = (details: Record<string, unknown>) =>
        safeRecord(services, {
          id: decisionId,
          conversationId,
          intent,
          action: definition.id,
          confidence,
          reason,
          details: { input: args, ...details },
        });

      try {
        if (definition.requiresConfirmation && input.confirmed !== true) {
          throw new ToolRejection(
            "confirmation_required",
            "Esta ação altera dados e exige confirmação explícita. Mostre ao funcionário o que será feito, pergunte se pode seguir e só chame de novo com confirmed=true após o sim dele.",
          );
        }
        if (definition.minConfidence !== undefined && confidence < definition.minConfidence) {
          throw new ToolRejection(
            "low_confidence",
            "Sua confiança está baixa demais para alterar dados. Faça uma pergunta para esclarecer ou ofereça transferir para um analista.",
          );
        }

        const data = await definition.run(input, context);
        await log({ outcome: "success", output: data });
        return { ok: true as const, data, decisionId };
      } catch (error) {
        const toolError = toToolError(error);
        await log({
          outcome: error instanceof ToolRejection ? "rejected" : "failed",
          error: toolError,
        });
        return { ok: false as const, error: toolError, decisionId };
      }
    },
  });
}

/** A failure to write the audit log must not break the conversation. */
async function safeRecord(services: AgentServices, decision: NewDecision): Promise<void> {
  try {
    await services.decisions.record(decision);
  } catch (error) {
    console.error("[nexo-assist] failed to record decision", error);
  }
}
