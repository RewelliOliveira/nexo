import { describe, expect, it } from "vitest";
import type { ConversationDetail, HistoryMessage } from "./console-state";
import { buildTimeline } from "./timeline";

const NOW = new Date("2026-10-28T15:00:00Z");

function message(id: string, role: HistoryMessage["role"], createdAt: string): HistoryMessage {
  return { id, role, content: id, createdAt, decisions: [] };
}

function detail(
  messages: HistoryMessage[],
  handedOffAt: string | null = null,
): ConversationDetail {
  return {
    conversation: {
      id: "conv-1",
      status: handedOffAt ? "awaiting_analyst" : "with_agent",
      employee: { id: "emp-ana", name: "Ana Souza", department: "Financeiro" },
      analystId: null,
      analystName: null,
      lastMessage: null,
      unanswered: 0,
      updatedAt: NOW.toISOString(),
      handoffReason: handedOffAt ? "employee_request" : null,
      handoffSummary: handedOffAt ? "Quer falar com um analista" : null,
      handoffTicketId: null,
      handoffConfidence: null,
      handedOffAt,
    },
    messages,
    pendingDecisions: [],
    tickets: [],
  };
}

const shape = (items: ReturnType<typeof buildTimeline>) =>
  items.map((item) => (item.kind === "message" ? item.message.id : item.kind));

describe("console timeline", () => {
  it("groups messages by day and marks runs from the same author", () => {
    const items = buildTimeline(
      detail([
        message("e1", "employee", "2026-10-27T13:00:00.000Z"),
        message("e2", "employee", "2026-10-28T13:00:00.000Z"),
        message("e3", "employee", "2026-10-28T13:00:01.000Z"),
        message("a1", "agent", "2026-10-28T13:00:05.000Z"),
      ]),
      NOW,
    );
    expect(shape(items)).toEqual(["day", "e1", "day", "e2", "e3", "a1"]);
    expect(items.flatMap((item) => (item.kind === "day" ? [item.label] : []))).toEqual([
      "Ontem",
      "Hoje",
    ]);
    expect(items.flatMap((item) => (item.kind === "message" ? [item.first] : []))).toEqual([
      true,
      true,
      false,
      true,
    ]);
  });

  it("marks the handoff after the reply that announced it", () => {
    const items = buildTimeline(
      detail(
        [
          message("e1", "employee", "2026-10-28T13:00:00.000Z"),
          message("a1", "agent", "2026-10-28T13:00:09.000Z"),
          message("e2", "employee", "2026-10-28T13:01:00.000Z"),
        ],
        "2026-10-28T13:00:05.000Z",
      ),
      NOW,
    );
    expect(shape(items)).toEqual(["day", "e1", "a1", "handoff", "e2"]);
  });

  it("marks the handoff before later messages when the agent said nothing", () => {
    const items = buildTimeline(
      detail(
        [
          message("e1", "employee", "2026-10-28T13:00:00.000Z"),
          message("s1", "system", "2026-10-28T13:10:00.000Z"),
        ],
        "2026-10-28T13:00:05.000Z",
      ),
      NOW,
    );
    expect(shape(items)).toEqual(["day", "e1", "handoff", "s1"]);
  });
});
