import { beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "@/db/test-database";
import {
  ConversationNotFoundError,
  createConversationService,
  type ConversationService,
} from "./conversation-service";
import {
  createDecisionLogService,
  type DecisionLogService,
} from "./decision-log-service";

describe("conversation service", () => {
  let conversations: ConversationService;
  let decisions: DecisionLogService;

  beforeEach(async () => {
    const db = await createTestDatabase(new Date());
    conversations = createConversationService({ db });
    decisions = createDecisionLogService({ db });
  });

  it("starts a new conversation with the agent", async () => {
    const conversation = await conversations.getOrCreate("emp-ana", "conv-1");
    expect(conversation).toMatchObject({ employeeId: "emp-ana", status: "with_agent" });
    expect(await conversations.getOrCreate("emp-ana", "conv-1")).toEqual(conversation);
  });

  it("never exposes another employee's conversation", async () => {
    await conversations.getOrCreate("emp-ana", "conv-1");
    await expect(conversations.getOrCreate("emp-bruno", "conv-1")).rejects.toThrow(
      ConversationNotFoundError,
    );
    await expect(conversations.get("emp-bruno", "conv-1")).rejects.toThrow(
      ConversationNotFoundError,
    );
  });

  it("counts what the employee sent to the agent across conversations", async () => {
    const start = new Date("2026-10-21T12:00:00Z");
    let at = start;
    const timed = createConversationService({
      db: await createTestDatabase(start),
      now: () => at,
    });
    await timed.getOrCreate("emp-ana", "conv-1");
    await timed.getOrCreate("emp-ana", "conv-2");
    await timed.getOrCreate("emp-bruno", "conv-3");

    await timed.addMessage("conv-1", "employee", "antes da janela");
    at = new Date("2026-10-22T12:00:00Z");
    await timed.addMessage("conv-1", "employee", "dentro da janela");
    await timed.addMessage("conv-2", "employee", "em outra conversa");
    await timed.addMessage("conv-2", "agent", "resposta não conta");
    await timed.addMessage("conv-2", "employee", "para o analista", { outsideAgent: true });
    await timed.addMessage("conv-3", "employee", "de outra pessoa");

    expect(await timed.countSentToAgentSince("emp-ana", at)).toBe(2);
    expect(await timed.countSentToAgentSince("emp-ana", start)).toBe(3);
  });

  it("finds the latest conversation of the employee", async () => {
    let tick = 0;
    conversations = createConversationService({
      db: await createTestDatabase(new Date()),
      now: () => new Date(Date.UTC(2026, 9, 28, 12, 0, tick++)),
    });
    expect(await conversations.findLatest("emp-ana")).toBeUndefined();
    await conversations.getOrCreate("emp-ana", "conv-1");
    await conversations.getOrCreate("emp-ana", "conv-2");
    await conversations.getOrCreate("emp-bruno", "conv-3");
    await conversations.addMessage("conv-1", "employee", "voltei");

    expect(await conversations.findLatest("emp-ana")).toMatchObject({ id: "conv-1" });
    expect(await conversations.findLatest("emp-bruno")).toMatchObject({ id: "conv-3" });
  });

  it("counts messages by role", async () => {
    await conversations.getOrCreate("emp-ana", "conv-1");
    await conversations.addMessage("conv-1", "employee", "oi");
    await conversations.addMessage("conv-1", "agent", "olá");
    await conversations.addMessage("conv-1", "employee", "minha VPN caiu");

    expect(await conversations.countMessages("conv-1", "employee")).toBe(2);
    expect(await conversations.countMessages("conv-1", "agent")).toBe(1);
  });

  it("attaches pending decisions to the reply", async () => {
    await conversations.getOrCreate("emp-ana", "conv-1");
    const decision = await decisions.record({
      conversationId: "conv-1",
      intent: "consultar chamados",
      action: "listMyTickets",
      confidence: 1.4,
      reason: "pediu o status",
    });
    expect(decision.confidence).toBe(1);
    expect(decision.messageId).toBeNull();

    const reply = await conversations.addMessage("conv-1", "agent", "Seus chamados...");
    await decisions.attachPending("conv-1", reply.id);

    expect(await decisions.get("conv-1", decision.id)).toMatchObject({
      messageId: reply.id,
    });
    expect(await decisions.get("conv-2", decision.id)).toBeUndefined();
  });
});
