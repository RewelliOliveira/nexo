import type { HandoffReason } from "@/lib/domain";
import { formatDay, formatTime } from "../../_lib/format";
import type { ConversationItem } from "./console-state";

// How the console presents conversations: filters, order, tags and previews

export const CONSOLE_FILTERS = ["all", "waiting", "agent", "mine"] as const;
export type ConsoleFilter = (typeof CONSOLE_FILTERS)[number];

export const CONSOLE_FILTER_LABEL: Record<ConsoleFilter, string> = {
  all: "Todas",
  waiting: "Para você",
  agent: "Com o agent",
  mine: "Minhas",
};

export function matchesFilter(
  conversation: ConversationItem,
  filter: ConsoleFilter,
  analystId: string,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "waiting":
      return conversation.status === "awaiting_analyst";
    case "agent":
      return conversation.status === "with_agent";
    case "mine":
      return conversation.status === "with_analyst" && conversation.analystId === analystId;
  }
}

/** By name, department, ticket or the last message. */
export function matchesSearch(conversation: ConversationItem, query: string): boolean {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalize(
    [
      conversation.employee.name,
      conversation.employee.department,
      conversation.handoffTicketId ?? "",
      conversation.lastMessage?.content ?? "",
    ].join(" "),
  );
  return terms.every((term) => haystack.includes(term));
}

/** Waiting for an analyst first, longest wait on top; then most recent activity. */
export function sortForConsole(conversations: ConversationItem[]): ConversationItem[] {
  const waitingSince = (item: ConversationItem) => item.handedOffAt ?? item.updatedAt;
  return [...conversations].sort((a, b) => {
    const aWaiting = a.status === "awaiting_analyst";
    const bWaiting = b.status === "awaiting_analyst";
    if (aWaiting !== bWaiting) return aWaiting ? -1 : 1;
    if (aWaiting) return waitingSince(a).localeCompare(waitingSince(b));
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

/** Needs someone at the service desk to act now. */
export function needsAttention(conversation: ConversationItem, analystId: string): boolean {
  if (conversation.status === "awaiting_analyst") return true;
  return (
    conversation.status === "with_analyst" &&
    conversation.analystId === analystId &&
    conversation.unanswered > 0
  );
}

export type ConversationTag = {
  tone: "danger" | "warning" | "cta" | "success" | "faint";
  label: string;
};

const HANDOFF_REASON_LABEL: Record<HandoffReason, string> = {
  employee_request: "pediu um analista",
  critical: "caso crítico",
  overdue: "chamado vencido",
  low_confidence: "agent sem segurança",
};

export function handoffReasonLabel(reason: HandoffReason): string {
  return HANDOFF_REASON_LABEL[reason];
}

/** The short line under each conversation saying who is handling it. */
export function conversationTag(
  conversation: ConversationItem,
  analystId: string,
): ConversationTag {
  switch (conversation.status) {
    case "awaiting_analyst": {
      if (conversation.handoffReason === "low_confidence") {
        const confidence = conversation.handoffConfidence;
        return {
          tone: "warning",
          label:
            confidence === null
              ? "Agent pediu ajuda"
              : `Agent pediu ajuda · confiança ${Math.round(confidence * 100)}%`,
        };
      }
      const detail =
        conversation.handoffTicketId ??
        (conversation.handoffReason ? HANDOFF_REASON_LABEL[conversation.handoffReason] : null);
      return { tone: "danger", label: detail ? `Transferida · ${detail}` : "Transferida" };
    }
    case "with_analyst":
      return {
        tone: "cta",
        label:
          conversation.analystId === analystId
            ? "Você está atendendo"
            : `${conversation.analystName ?? "Um analista"} está atendendo`,
      };
    case "with_agent":
      return { tone: "success", label: "Agent atendendo" };
    case "closed":
      return {
        tone: "faint",
        label: conversation.analystName
          ? `Encerrada por ${firstName(conversation.analystName)}`
          : "Encerrada",
      };
  }
}

export type MessagePreview = {
  /** Who wrote it, when it was not the employee: "Nexo", "Você" */
  author: string | null;
  text: string;
};

export function messagePreview(
  conversation: ConversationItem,
  analystId: string,
): MessagePreview | null {
  const message = conversation.lastMessage;
  if (!message) return null;
  const text = plainText(message.content);
  switch (message.role) {
    case "agent":
      return { author: "Nexo", text };
    case "analyst":
      return {
        author:
          conversation.analystId === analystId
            ? "Você"
            : firstName(conversation.analystName ?? "Analista"),
        text,
      };
    default:
      return { author: null, text };
  }
}

const MINUTE = 60 * 1000;

/** "agora", "10:05", "ontem" or "16 out", like a messaging app. */
export function formatListTime(date: Date, now: Date): string {
  if (now.getTime() - date.getTime() < MINUTE) return "agora";
  if (formatDay(date) === formatDay(now)) return formatTime(date);
  if (formatDay(date) === formatDay(new Date(now.getTime() - 24 * 60 * MINUTE))) return "ontem";
  return formatDay(date);
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Avatar colors from the design, picked by employee so each keeps one. */
const AVATAR_COLORS = [
  "bg-[#DCE9F7] text-[#0062C4]",
  "bg-[#F6E3D3] text-[#9A4A12]",
  "bg-[#E6E1F7] text-[#5B3FC4]",
  "bg-[#DDF0E6] text-[#1E7A4C]",
  "bg-[#F7E1E6] text-[#A3324F]",
  "bg-[#E5E8EC] text-[#3D4656]",
  "bg-[#FBEFD0] text-[#8A6100]",
] as const;

export function avatarColor(employeeId: string): string {
  let hash = 0;
  for (const char of employeeId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

/** The agent's markdown flattened to one line, for previews. */
function plainText(content: string): string {
  return content
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
