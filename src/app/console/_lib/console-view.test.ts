import { describe, expect, it } from "vitest";
import type { ConversationItem } from "./console-state";
import {
  conversationTag,
  formatListTime,
  matchesFilter,
  matchesSearch,
  messagePreview,
  needsAttention,
  sortForConsole,
} from "./console-view";

const ME = "emp-marina";

function item(overrides: Partial<ConversationItem> = {}): ConversationItem {
  return {
    id: "conv-1",
    status: "with_agent",
    employee: { id: "emp-ana", name: "Ana Souza", department: "Financeiro" },
    analystId: null,
    analystName: null,
    lastMessage: null,
    unanswered: 0,
    updatedAt: "2026-10-28T13:00:00.000Z",
    handoffReason: null,
    handoffSummary: null,
    handoffTicketId: null,
    handoffConfidence: null,
    handedOffAt: null,
    ...overrides,
  };
}

const waiting = item({
  id: "waiting",
  status: "awaiting_analyst",
  handoffReason: "employee_request",
  handoffTicketId: "INC-20311",
  handedOffAt: "2026-10-28T13:05:00.000Z",
});
const mine = item({
  id: "mine",
  status: "with_analyst",
  analystId: ME,
  analystName: "Marina Alves",
});
const theirs = item({ id: "theirs", status: "with_analyst", analystId: "emp-rafael" });

describe("console view", () => {
  it("filters by who is handling the conversation", () => {
    const all = [item(), waiting, mine, theirs, item({ status: "closed" })];
    const ids = (filter: Parameters<typeof matchesFilter>[1]) =>
      all.filter((c) => matchesFilter(c, filter, ME)).map((c) => c.id);
    expect(ids("all")).toHaveLength(5);
    expect(ids("waiting")).toEqual(["waiting"]);
    expect(ids("agent")).toEqual(["conv-1"]);
    expect(ids("mine")).toEqual(["mine"]);
  });

  it("searches name, department and ticket ignoring accents and case", () => {
    expect(matchesSearch(waiting, "ana financeiro")).toBe(true);
    expect(matchesSearch(waiting, "inc-20311")).toBe(true);
    const fabio = item({ employee: { id: "e", name: "Fábio Nunes", department: "TI" } });
    expect(matchesSearch(fabio, "fabio")).toBe(true);
    expect(matchesSearch(waiting, "bruno")).toBe(false);
  });

  it("puts conversations waiting for an analyst on top, longest wait first", () => {
    const later = { ...waiting, id: "later", handedOffAt: "2026-10-28T13:30:00.000Z" };
    const recent = item({ id: "recent", updatedAt: "2026-10-28T14:00:00.000Z" });
    expect(sortForConsole([recent, later, mine, waiting]).map((c) => c.id)).toEqual([
      "waiting",
      "later",
      "recent",
      "mine",
    ]);
  });

  it("highlights what needs the analyst", () => {
    expect(needsAttention(waiting, ME)).toBe(true);
    expect(needsAttention(mine, ME)).toBe(false);
    expect(needsAttention({ ...mine, unanswered: 2 }, ME)).toBe(true);
    expect(needsAttention({ ...theirs, unanswered: 2 }, ME)).toBe(false);
  });

  it("tags each conversation with who is handling it", () => {
    expect(conversationTag(waiting, ME)).toEqual({
      tone: "danger",
      label: "Transferida · INC-20311",
    });
    expect(
      conversationTag({ ...waiting, handoffTicketId: null, handoffReason: "critical" }, ME).label,
    ).toBe("Transferida · caso crítico");
    expect(
      conversationTag({ ...waiting, handoffReason: "low_confidence", handoffConfidence: 0.41 }, ME),
    ).toEqual({ tone: "warning", label: "Agent pediu ajuda · confiança 41%" });
    expect(conversationTag(mine, ME).label).toBe("Você está atendendo");
    expect(conversationTag({ ...theirs, analystName: "Rafael Lima" }, ME).label).toBe(
      "Rafael Lima está atendendo",
    );
    expect(conversationTag(item({ status: "closed", analystName: "Marina Alves" }), ME).label).toBe(
      "Encerrada por Marina",
    );
  });

  it("previews the last message with its author", () => {
    const at = "2026-10-28T13:00:00.000Z";
    const agent = item({
      lastMessage: { role: "agent", content: "Seus chamados:\n- **INC-1** VPN", createdAt: at },
    });
    expect(messagePreview(agent, ME)).toEqual({ author: "Nexo", text: "Seus chamados: INC-1 VPN" });
    const reply = item({
      status: "with_analyst",
      analystId: ME,
      lastMessage: { role: "analyst", content: "Oi!", createdAt: at },
    });
    expect(messagePreview(reply, ME)?.author).toBe("Você");
    const employee = item({ lastMessage: { role: "employee", content: "oi", createdAt: at } });
    expect(messagePreview(employee, ME)).toEqual({ author: null, text: "oi" });
  });

  it("shows list times like a messaging app", () => {
    const now = new Date("2026-10-28T15:00:00Z");
    expect(formatListTime(new Date("2026-10-28T14:59:30Z"), now)).toBe("agora");
    expect(formatListTime(new Date("2026-10-28T13:05:00Z"), now)).toBe("10:05");
    expect(formatListTime(new Date("2026-10-27T13:05:00Z"), now)).toBe("ontem");
    expect(formatListTime(new Date("2026-10-20T13:05:00Z"), now)).toBe("20 out");
  });
});
