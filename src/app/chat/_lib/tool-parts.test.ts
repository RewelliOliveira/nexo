import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { actionLabels } from "./action-labels";
import {
  overdueTicketsOf,
  quickRepliesOf,
  quickReplyQuestionOf,
  toCardTicket,
  toolCallsOf,
} from "./tool-parts";

const TICKET = {
  id: "INC-20311",
  type: "INC",
  category: "hardware",
  priority: "medium",
  status: "awaiting_analyst",
  title: "Notebook lento após atualização",
  affected: "Apenas eu",
  isOverdue: true,
  createdAt: "16/10/2026, 14:20",
  updatedAt: "23/10/2026, 09:00",
  dueAt: "21/10/2026, 14:20",
  resolvedAt: null,
} as const;

function agentMessage(parts: UIMessage["parts"]): UIMessage {
  return { id: "m1", role: "assistant", parts };
}

describe("tool parts of an agent message", () => {
  it("reads a finished call with its result and decision", () => {
    const [call] = toolCallsOf(
      agentMessage([
        {
          type: "tool-listMyTickets",
          toolCallId: "c1",
          state: "output-available",
          input: { intent: "ver chamados" },
          output: { ok: true, data: { tickets: [TICKET] }, decisionId: "d1" },
        },
      ]),
    );
    expect(call).toMatchObject({
      state: "done",
      decisionId: "d1",
      result: { tool: "listMyTickets", data: { tickets: [{ id: "INC-20311" }] } },
    });
    expect(actionLabels(call)).toEqual(["consultou seus chamados"]);
  });

  it("shows a call still running", () => {
    const [call] = toolCallsOf(
      agentMessage([
        {
          type: "tool-getTicket",
          toolCallId: "c1",
          state: "input-available",
          input: { ticketId: "inc-20311" },
        },
      ]),
    );
    expect(call).toMatchObject({ state: "running", ticketId: "INC-20311" });
    expect(actionLabels(call)).toEqual(["consultando o chamado…"]);
  });

  it("explains failures in plain words", () => {
    const [unavailable, invalid] = toolCallsOf(
      agentMessage([
        {
          type: "tool-listMyTickets",
          toolCallId: "c1",
          state: "output-available",
          input: {},
          output: {
            ok: false,
            error: { code: "service_unavailable", message: "fora do ar" },
            decisionId: "d1",
          },
        },
        {
          type: "tool-getTicket",
          toolCallId: "c2",
          state: "output-available",
          input: {},
          output: { error: true, message: "Tool input validation failed" },
        },
      ]),
    );
    expect(unavailable).toMatchObject({ state: "failed", errorCode: "service_unavailable" });
    expect(actionLabels(unavailable)).toEqual(["sistema de chamados fora do ar"]);
    expect(invalid).toMatchObject({ state: "failed", decisionId: null });
  });

  it("names the ticket opened and the automatic handoff", () => {
    const [call] = toolCallsOf(
      agentMessage([
        {
          type: "tool-createTicket",
          toolCallId: "c1",
          state: "output-available",
          input: {},
          output: {
            ok: true,
            data: { ticket: { ...TICKET, id: "INC-20517" }, handedOffToAnalyst: true },
            decisionId: "d1",
          },
        },
      ]),
    );
    expect(actionLabels(call)).toEqual(["abriu o INC-20517", "transferiu para um analista"]);
  });

  it("keeps quick replies out of the actions", () => {
    const message = agentMessage([
      { type: "text", text: "Quem está sendo afetado?" },
      {
        type: "tool-suggestReplies",
        toolCallId: "c1",
        state: "output-available",
        input: { options: ["Só eu", "Minha equipe"] },
        output: { shown: true },
      },
    ]);
    expect(toolCallsOf(message)).toEqual([]);
    expect(quickRepliesOf(message)).toEqual(["Só eu", "Minha equipe"]);
  });

  it("reads the question of the quick replies, when there is one", () => {
    const part = {
      type: "tool-suggestReplies",
      toolCallId: "c1",
      state: "output-available",
      output: { shown: true },
    } as const;
    const asked = agentMessage([
      { ...part, input: { question: "Quem é afetado?", options: ["Só eu", "Minha equipe"] } },
    ]);
    const stored = agentMessage([{ ...part, input: { options: ["Só eu", "Minha equipe"] } }]);
    expect(quickReplyQuestionOf(asked)).toBe("Quem é afetado?");
    expect(quickReplyQuestionOf(stored)).toBeNull();
  });
});

describe("overdue tickets of a reply", () => {
  const listing = (tickets: unknown[]) => ({
    type: "tool-listMyTickets" as const,
    toolCallId: "c1",
    state: "output-available" as const,
    input: {},
    output: { ok: true, data: { tickets }, decisionId: "d1" },
  });

  it("finds the overdue tickets of a listing", () => {
    const calls = toolCallsOf(
      agentMessage([listing([TICKET, { ...TICKET, id: "REQ-10442", isOverdue: false }])]),
    );
    expect(overdueTicketsOf(calls)).toEqual(["INC-20311"]);
  });

  it("finds an overdue ticket opened on its own", () => {
    const calls = toolCallsOf(
      agentMessage([
        {
          type: "tool-getTicket",
          toolCallId: "c1",
          state: "output-available",
          input: { ticketId: "INC-20311" },
          output: {
            ok: true,
            data: { ticket: { ...TICKET, description: "Lento", updates: [] } },
            decisionId: "d1",
          },
        },
      ]),
    );
    expect(overdueTicketsOf(calls)).toEqual(["INC-20311"]);
  });

  it("ignores a listing that was only a step towards something else", () => {
    const calls = toolCallsOf(
      agentMessage([
        listing([TICKET]),
        {
          type: "tool-handoffToAnalyst",
          toolCallId: "c2",
          state: "output-available",
          input: {},
          output: { ok: true, data: { ticket: TICKET }, decisionId: "d2" },
        },
      ]),
    );
    expect(overdueTicketsOf(calls)).toEqual([]);
  });

  it("offers nothing when no ticket is overdue", () => {
    const calls = toolCallsOf(agentMessage([listing([{ ...TICKET, isOverdue: false }])]));
    expect(overdueTicketsOf(calls)).toEqual([]);
  });
});

describe("tickets from tool results", () => {
  it("turns the shown dates back into dates for the card", () => {
    expect(toCardTicket(TICKET)).toMatchObject({
      id: "INC-20311",
      createdAt: new Date("2026-10-16T17:20:00Z"),
      isOverdue: true,
    });
  });
});
