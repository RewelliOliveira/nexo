import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { actionLabels } from "./action-labels";
import { quickRepliesOf, toCardTicket, toolCallsOf } from "./tool-parts";

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
