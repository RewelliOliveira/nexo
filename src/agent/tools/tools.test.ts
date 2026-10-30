import { beforeEach, describe, expect, it } from "vitest";
import { CONVERSATION_ID, createHarness, type Harness } from "./test-harness";

const VPN_DRAFT = {
  title: "VPN com erro 809 no Windows 11",
  description: "A VPN mostra o erro 809 ao conectar de casa desde ontem. Já reiniciei o notebook.",
  type: "INC",
  category: "network_vpn",
  priority: "high",
  affected: "Apenas eu",
};

describe("nexo tools", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
    h.employeeSays();
  });

  async function draft(input: Record<string, unknown> = VPN_DRAFT): Promise<string> {
    const result = await h.run("draftTicket", input);
    expect(result).toMatchObject({ ok: true });
    return (result as { data: { draftId: string } }).data.draftId;
  }

  describe("opening a ticket", () => {
    it("drafts without creating anything", async () => {
      const result = await h.run("draftTicket", VPN_DRAFT);
      expect(result).toMatchObject({
        ok: true,
        data: { draft: { title: VPN_DRAFT.title, priority: "high" }, similar: { active: [] } },
      });
      const list = await h.run("listMyTickets", {});
      expect(JSON.stringify(list)).not.toContain(VPN_DRAFT.title);
    });

    it("creates the ticket from the draft once the employee confirms", async () => {
      const draftId = await draft();
      h.employeeSays();

      const result = await h.run("createTicket", { draftId, confirmed: true });
      expect(result).toMatchObject({
        ok: true,
        data: {
          ticket: { title: VPN_DRAFT.title, status: "open", priority: "high" },
          handedOffToAnalyst: false,
        },
      });
    });

    it("refuses to create without the confirmation flag", async () => {
      const draftId = await draft();
      h.employeeSays();

      const result = await h.run("createTicket", { draftId, confirmed: false });
      expect(result).toMatchObject({ ok: false, error: { code: "confirmation_required" } });
    });

    it("refuses a draft the employee has not seen yet", async () => {
      const draftId = await draft();

      const result = await h.run("createTicket", { draftId, confirmed: true });
      expect(result).toMatchObject({ ok: false, error: { code: "draft_not_confirmed" } });
    });

    it("refuses an unknown draft", async () => {
      const result = await h.run("createTicket", { draftId: "made-up", confirmed: true });
      expect(result).toMatchObject({ ok: false, error: { code: "draft_not_found" } });
    });

    it("refuses to change data with low confidence", async () => {
      const draftId = await draft();
      h.employeeSays();

      const result = await h.run("createTicket", { draftId, confirmed: true, confidence: 0.3 });
      expect(result).toMatchObject({ ok: false, error: { code: "low_confidence" } });
    });

    it("hands critical tickets off to an analyst", async () => {
      const draftId = await draft({
        ...VPN_DRAFT,
        title: "ERP fora do ar para o financeiro",
        category: "software",
        priority: "critical",
        affected: "Time financeiro (12 pessoas)",
      });
      h.employeeSays();

      const result = await h.run("createTicket", { draftId, confirmed: true });
      expect(result).toMatchObject({
        ok: true,
        data: { ticket: { status: "awaiting_analyst" }, handedOffToAnalyst: true },
      });
      const conversation = await h.services.conversations.get("emp-ana", CONVERSATION_ID);
      expect(conversation).toMatchObject({ status: "awaiting_analyst", handoffReason: "critical" });
    });
  });

  describe("duplicates", () => {
    const SLOW_NOTEBOOK = {
      ...VPN_DRAFT,
      title: "Notebook muito lento depois da atualização",
      category: "hardware",
      priority: "medium",
    };

    it("points to the open ticket about the same problem in the draft", async () => {
      const result = await h.run("draftTicket", SLOW_NOTEBOOK);
      expect(result).toMatchObject({
        ok: true,
        data: { similar: { active: [{ id: "INC-20311" }] } },
      });
    });

    it("blocks creating a duplicate even if the model insists", async () => {
      const draftId = await draft(SLOW_NOTEBOOK);
      h.employeeSays();

      const result = await h.run("createTicket", { draftId, confirmed: true });
      expect(result).toMatchObject({
        ok: false,
        error: { code: "duplicate", details: { existingTickets: [{ id: "INC-20311" }] } },
      });
    });

    it("offers to reopen a ticket resolved in the last 7 days", async () => {
      const result = await h.run("findSimilarTickets", {
        title: "Senha do SAP bloqueada de novo",
        category: "access",
      });
      expect(result).toMatchObject({
        ok: true,
        data: { active: [], reopenable: [{ id: "INC-20150" }] },
      });

      const reopened = await h.run("reopenTicket", {
        ticketId: "INC-20150",
        reopenReason: "O SAP bloqueou de novo hoje cedo.",
        confirmed: true,
      });
      expect(reopened).toMatchObject({ ok: true, data: { ticket: { status: "open" } } });
    });

    it("updates the existing ticket instead", async () => {
      const result = await h.run("updateTicket", {
        ticketId: "inc-20311",
        comment: "Agora também trava ao abrir o Teams.",
        confirmed: true,
      });
      expect(result).toMatchObject({ ok: true, data: { ticket: { id: "INC-20311" } } });
    });
  });

  describe("overdue tickets", () => {
    it("flags the overdue ticket", async () => {
      const result = await h.run("listMyTickets", {});
      expect(result).toMatchObject({
        ok: true,
        data: {
          tickets: expect.arrayContaining([
            expect.objectContaining({ id: "INC-20311", isOverdue: true }),
            expect.objectContaining({ id: "REQ-10442", isOverdue: false }),
          ]),
        },
      });
    });

    it("hands the conversation off with a summary", async () => {
      const result = await h.run("handoffToAnalyst", {
        handoffReason: "overdue",
        summary: "INC-20311 vencido há 3 dias; notebook segue lento e a funcionária pediu ajuda.",
        ticketId: "INC-20311",
        confirmed: true,
      });
      expect(result).toMatchObject({
        ok: true,
        data: { status: "awaiting_analyst", ticket: { id: "INC-20311" } },
      });
    });
  });

  describe("privacy", () => {
    it("does not reveal another employee's ticket", async () => {
      const result = await h.run("getTicket", { ticketId: "INC-20320" });
      expect(result).toMatchObject({ ok: false, error: { code: "not_found" } });
      expect(JSON.stringify(result)).not.toContain("Windows 11");
    });

    it("ignores an employee id sent by the model", async () => {
      const result = await h.run("getTicket", { ticketId: "INC-20320", employeeId: "emp-bruno" });
      expect(result).toMatchObject({ ok: false, error: { code: "not_found" } });
    });

    it("cannot change another employee's ticket", async () => {
      const result = await h.run("updateTicket", {
        ticketId: "INC-20320",
        comment: "teste de acesso",
        confirmed: true,
      });
      expect(result).toMatchObject({ ok: false, error: { code: "not_found" } });
    });

    it("refuses to run without a logged-in employee", async () => {
      const result = await h.run("listMyTickets", {}, { employeeId: null });
      expect(result).toMatchObject({ ok: false, error: { code: "unauthenticated" } });
    });
  });

  describe("decision log", () => {
    it("records intent, action, confidence and reason for every call", async () => {
      await h.run("searchKnowledgeBase", {
        query: "erro 809 na VPN",
        intent: "Resolver erro da VPN",
        confidence: 0.8,
        reason: "Existe artigo sobre o erro 809",
      });
      await h.run("getTicket", { ticketId: "INC-20320" });

      const logs = await h.services.decisions.listByConversation(CONVERSATION_ID);
      expect(logs).toMatchObject([
        {
          action: "searchKnowledgeBase",
          intent: "Resolver erro da VPN",
          confidence: 0.8,
          reason: "Existe artigo sobre o erro 809",
          details: { outcome: "success", input: { query: "erro 809 na VPN" } },
        },
        { action: "getTicket", details: { outcome: "failed", error: { code: "not_found" } } },
      ]);
    });

    it("returns the decision id so the chat can show the decision", async () => {
      const result = await h.run("getTicket", { ticketId: "INC-20320" });
      const [log] = await h.services.decisions.listByConversation(CONVERSATION_ID);
      expect(result).toMatchObject({ ok: false, decisionId: log.id });
    });

    it("links the automatic handoff to the call that triggered it", async () => {
      const draftId = await draft({ ...VPN_DRAFT, priority: "critical", affected: "Time todo" });
      h.employeeSays();
      const result = await h.run("createTicket", { draftId, confirmed: true });

      const logs = await h.services.decisions.listByConversation(CONVERSATION_ID);
      const handoff = logs.find((log) => log.action === "handoffToAnalyst");
      expect(handoff?.details).toMatchObject({
        automatic: true,
        parentDecisionId: (result as { decisionId: string }).decisionId,
      });
    });
  });
});

describe("legacy ticket system outages", () => {
  it("retries and succeeds when the outage ends", async () => {
    let calls = 0;
    const h = await createHarness({
      ticketOptions: { failureRate: 1, random: () => (calls++ === 0 ? 0 : 1) },
    });

    const result = await h.run("listMyTickets", {});
    expect(result).toMatchObject({ ok: true });
  });

  it("returns a friendly error when it stays down", async () => {
    const h = await createHarness({ ticketOptions: { failureRate: 1, random: () => 0 } });

    const result = await h.run("listMyTickets", {});
    expect(result).toMatchObject({ ok: false, error: { code: "service_unavailable" } });
    expect((result as { error: { message: string } }).error.message).toMatch(/tentar novamente/);
  });
});
