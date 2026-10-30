import type { ConversationStatus, TicketPriority, TicketStatus } from "@/db/schema";
import {
  CONVERSATION_STATUS_LABEL,
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
} from "../_lib/labels";

type Tone = "danger" | "warning" | "success" | "primary" | "cta" | "neutral" | "faint";

const DOT_CLASS: Record<Tone, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  success: "bg-success",
  primary: "bg-primary",
  cta: "bg-cta",
  neutral: "bg-ink/40",
  faint: "bg-ink/25",
};

const TEXT_CLASS: Record<Tone, string> = {
  danger: "text-danger-text",
  warning: "text-warning-text",
  success: "text-success-text",
  primary: "text-primary-text",
  cta: "text-primary-text",
  neutral: "text-ink-3",
  faint: "text-ink-3",
};

const PRIORITY_TONE: Record<TicketPriority, Tone> = {
  critical: "danger",
  high: "warning",
  medium: "neutral",
  low: "faint",
};

const TICKET_STATUS_TONE: Record<TicketStatus, Tone> = {
  open: "primary",
  in_progress: "primary",
  awaiting_analyst: "warning",
  approved: "success",
  resolved: "faint",
  closed: "faint",
};

const CONVERSATION_STATUS_TONE: Record<ConversationStatus, Tone> = {
  with_agent: "success",
  awaiting_analyst: "danger",
  with_analyst: "cta",
  closed: "faint",
};

type DotBadgeProps = {
  tone: Tone;
  label: string;
  /** Overrides the tone's text color */
  textClassName?: string;
  className?: string;
};

function DotBadge({ tone, label, textClassName, className = "" }: DotBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${className}`}>
      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${DOT_CLASS[tone]}`} />
      <span className={textClassName ?? TEXT_CLASS[tone]}>{label}</span>
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <DotBadge
      tone={PRIORITY_TONE[priority]}
      label={TICKET_PRIORITY_LABEL[priority]}
      textClassName="text-ink"
      className="text-[14.5px] font-medium"
    />
  );
}

type TicketStatusBadgeProps = {
  status: TicketStatus;
  /** Gray label, for dense lists where only the dot carries color */
  muted?: boolean;
};

export function TicketStatusBadge({ status, muted = false }: TicketStatusBadgeProps) {
  return (
    <DotBadge
      tone={TICKET_STATUS_TONE[status]}
      label={TICKET_STATUS_LABEL[status]}
      textClassName={muted ? "text-ink-3" : undefined}
      className={`text-[12.5px] ${muted ? "font-normal" : "font-medium"}`}
    />
  );
}

export function ConversationStatusBadge({ status }: { status: ConversationStatus }) {
  const tone = CONVERSATION_STATUS_TONE[status];
  return (
    <DotBadge
      tone={tone}
      label={CONVERSATION_STATUS_LABEL[status]}
      // The design keeps routine states gray and colors only those needing attention
      textClassName={tone === "success" ? "text-ink-3" : undefined}
      className="text-[11.5px] font-medium"
    />
  );
}

/** Just the colored dot of a ticket status, for dense lists. */
export function TicketStatusDot({ status }: { status: TicketStatus }) {
  return (
    <span
      aria-hidden
      className={`size-1.75 shrink-0 rounded-full ${DOT_CLASS[TICKET_STATUS_TONE[status]]}`}
    />
  );
}
