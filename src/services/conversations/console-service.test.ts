import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/client";
import { createTestDatabase } from "@/db/test-database";
import { createTicketService } from "@/services/tickets";
import {
  ConversationStateError,
  createConsoleService,
  type ConsoleService,
} from "./console-service";
import {
  createConversationService,
  type ConversationService,
} from "./conversation-service";
import { createDecisionLogService } from "./decision-log-service";

const MARINA = { id: "emp-marina", name: "Marina Alves" };
const OTHER_ANALYST = { id: "emp-other", name: "Rafael Lima" };

describe("console service", () => {
  let db: Database;
  let conversations: ConversationService;
  let console_: ConsoleService;
  let tick: number;
  let now: () => Date;

  beforeEach(async () => {
    tick = 0;
    now = () => new Date(Date.UTC(2026, 9, 28, 12, 0, tick++));
    db = await createTestDatabase(new Date(Date.UTC(2026, 9, 28)));
    conversations = createConversationService({ db, now });
    console_ = createConsoleService({ db, now });
  });

  async function handedOff(conversationId: string, employeeId = "emp-ana") {
    await conversations.getOrCreate(employeeId, conversationId);
    await conversations.addMessage(conversationId, "employee", "minha VPN caiu");
    await createDecisionLogService({ db, now }).record({
      conversationId,
      intent: "falar com um analista",
      action: "handoffToAnalyst",
      confidence: 0.41,
      reason: "não tenho segurança",
    });
    await createTicketService({ db, now }).handoff(employeeId, {
      conversationId,
      reason: "low_confidence",
      summary: "VPN cai a cada 10 minutos desde ontem",
    });
  }

  it("lists every employee's conversations, most recent first", async () => {
    await handedOff("conv-ana");
    await conversations.getOrCreate("emp-bruno", "conv-bruno");
    await conversations.addMessage("conv-bruno", "employee", "oi");
    await conversations.addMessage("conv-bruno", "agent", "Olá! Como posso ajudar?");

    const list = await console_.list();
    expect(list.map((item) => item.id)).toEqual(["conv-bruno", "conv-ana"]);
    expect(list[0]).toMatchObject({
      employee: { name: "Bruno Lima", department: "Comercial" },
      lastMessage: { role: "agent", content: "Olá! Como posso ajudar?" },
      unanswered: 0,
      handoffConfidence: null,
    });
    expect(list[1]).toMatchObject({
      status: "awaiting_analyst",
      handoffReason: "low_confidence",
      handoffSummary: "VPN cai a cada 10 minutos desde ontem",
      unanswered: 1,
      handoffConfidence: 0.41,
    });
  });

  it("pauses the agent when an analyst takes over", async () => {
    await handedOff("conv-ana");
    const taken = await console_.assume("conv-ana", MARINA);
    expect(taken).toMatchObject({
      status: "with_analyst",
      analystId: MARINA.id,
      analystName: "Marina Alves",
    });

    const history = await console_.listMessages("conv-ana");
    expect(history.at(-1)).toMatchObject({
      role: "system",
      content: "Marina Alves assumiu · agent pausado",
    });
    // The system note is not a reply to the employee
    expect((await console_.get("conv-ana")).unanswered).toBe(1);
  });

  it("can take over a conversation the agent is still handling", async () => {
    await conversations.getOrCreate("emp-ana", "conv-ana");
    await expect(console_.assume("conv-ana", MARINA)).resolves.toMatchObject({
      status: "with_analyst",
    });
  });

  it("lets only one analyst take a conversation", async () => {
    await handedOff("conv-ana");
    await console_.assume("conv-ana", MARINA);
    for (const action of [console_.assume, console_.release, console_.close]) {
      await expect(action("conv-ana", OTHER_ANALYST)).rejects.toThrow(ConversationStateError);
    }
  });

  it("gives the conversation back to the agent", async () => {
    await handedOff("conv-ana");
    await console_.assume("conv-ana", MARINA);
    const released = await console_.release("conv-ana", MARINA);
    expect(released).toMatchObject({ status: "with_agent", analystId: null });
    expect((await console_.listMessages("conv-ana")).at(-1)?.content).toBe(
      "Marina Alves devolveu ao agent",
    );
  });

  it("gives a waiting conversation back without taking it", async () => {
    await handedOff("conv-ana");
    await expect(console_.release("conv-ana", MARINA)).resolves.toMatchObject({
      status: "with_agent",
    });
  });

  it("closes only conversations the analyst took", async () => {
    await handedOff("conv-ana");
    await expect(console_.close("conv-ana", MARINA)).rejects.toThrow(ConversationStateError);
    await console_.assume("conv-ana", MARINA);
    const closed = await console_.close("conv-ana", MARINA);
    expect(closed.status).toBe("closed");
    expect(closed.closedAt).toBeInstanceOf(Date);
    await expect(console_.assume("conv-ana", MARINA)).rejects.toThrow(ConversationStateError);
  });
});
