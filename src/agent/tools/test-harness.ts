import { RequestContext } from "@mastra/core/request-context";
import type { Database } from "@/db/client";
import { createTestDatabase } from "@/db/test-database";
import {
  createConversationService,
  createDecisionLogService,
} from "@/services/conversations";
import { createKbService } from "@/services/kb";
import {
  createTicketService,
  type TicketServiceOptions,
} from "@/services/tickets";
import type { NexoRequestContext } from "../request-context";
import type { AgentServices } from "../services";
import { createNexoTools, type NexoTools } from "./index";

export const CONVERSATION_ID = "conv-test";

export type Harness = {
  db: Database;
  services: AgentServices;
  tools: NexoTools;
  clock: { now: Date };
  /** Simulates the employee sending a message, as seen by the agent memory */
  employeeSays(): void;
  run<K extends keyof NexoTools>(
    name: K,
    input: Record<string, unknown>,
    options?: { employeeId?: string | null },
  ): Promise<unknown>;
};

/**
 * Real services over an in-memory database, calling the tools the way the
 * agent loop does: identity in the request context, messages from memory.
 */
export async function createHarness(
  ticketOptions: Partial<TicketServiceOptions> = {},
): Promise<Harness> {
  const clock = { now: new Date("2026-10-28T14:00:00Z") };
  const now = () => clock.now;
  const db = await createTestDatabase(now());

  const services: AgentServices = {
    tickets: createTicketService({ db, now, ...ticketOptions }),
    kb: createKbService({ db }),
    conversations: createConversationService({ db, now }),
    decisions: createDecisionLogService({ db, now }),
    retry: {
      sleep: async (ms) => {
        clock.now = new Date(clock.now.getTime() + ms);
      },
    },
  };
  const tools = createNexoTools(services);
  const memory: { role: string; createdAt: Date }[] = [];

  const tick = () => {
    clock.now = new Date(clock.now.getTime() + 1000);
  };

  return {
    db,
    services,
    tools,
    clock,
    employeeSays() {
      tick();
      memory.push({ role: "user", createdAt: clock.now });
      tick();
    },
    async run(name, input, { employeeId = "emp-ana" } = {}) {
      const requestContext = new RequestContext<NexoRequestContext>();
      if (employeeId) requestContext.set("employeeId", employeeId);
      requestContext.set("conversationId", CONVERSATION_ID);

      const tool = tools[name];
      if (!tool.execute) throw new Error(`tool ${name} has no execute`);
      const result = await tool.execute(
        { intent: "teste", confidence: 0.9, reason: "teste", ...input } as never,
        {
          requestContext,
          agent: {
            agentId: "nexo-assist",
            toolCallId: crypto.randomUUID(),
            messages: [],
            getMessages: () => memory,
            suspend: async () => {},
            threadId: CONVERSATION_ID,
          },
        } as never,
      );
      tick();
      return result;
    },
  };
}
