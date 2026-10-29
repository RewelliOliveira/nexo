import { formatDay } from "../../_lib/format";
import type { DecisionView } from "../../chat/_lib/chat-state";
import type { ConversationDetail, HistoryMessage } from "./console-state";

// The open conversation as the console draws it: messages grouped by day,
// with the handoff placed where it happened

export type TimelineItem =
  | { kind: "day"; key: string; label: string }
  | {
      kind: "message";
      key: string;
      message: HistoryMessage;
      /** First of a run from the same author: shows the sender and a tail */
      first: boolean;
    }
  | { kind: "handoff"; key: string; at: string }
  | { kind: "pending"; key: string; decisions: DecisionView[] };

export function buildTimeline(detail: ConversationDetail, now: Date): TimelineItem[] {
  const { conversation, messages, pendingDecisions } = detail;
  const items: TimelineItem[] = [];
  let lastDay: string | null = null;
  let lastRole: HistoryMessage["role"] | null = null;
  let handoffPlaced = conversation.handedOffAt === null;

  const addDay = (at: string) => {
    const day = formatDay(new Date(at));
    if (day === lastDay) return;
    lastDay = day;
    lastRole = null;
    items.push({ kind: "day", key: `day-${day}`, label: dayLabel(new Date(at), now) });
  };
  const addHandoff = (at: string) => {
    addDay(at);
    items.push({ kind: "handoff", key: "handoff", at });
    lastRole = null;
    handoffPlaced = true;
  };

  const handedOffAt = conversation.handedOffAt;
  for (const message of messages) {
    // The reply announcing the handoff is saved after it, so the mark goes
    // right after that reply, or before anything else written later
    const afterHandoff = !handoffPlaced && handedOffAt !== null && message.createdAt > handedOffAt;
    if (afterHandoff && message.role !== "agent") addHandoff(handedOffAt);
    addDay(message.createdAt);
    const first = message.role === "system" || message.role !== lastRole;
    items.push({ kind: "message", key: message.id, message, first });
    lastRole = message.role === "system" ? null : message.role;
    if (afterHandoff && message.role === "agent") addHandoff(handedOffAt);
  }
  if (!handoffPlaced && handedOffAt) addHandoff(handedOffAt);

  const pending = pendingDecisions.filter((decision) => decision.parentId === null);
  if (pending.length > 0) {
    items.push({ kind: "pending", key: "pending", decisions: pendingDecisions });
  }
  return items;
}

function dayLabel(date: Date, now: Date): string {
  const day = formatDay(date);
  if (day === formatDay(now)) return "Hoje";
  if (day === formatDay(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return "Ontem";
  return day;
}
