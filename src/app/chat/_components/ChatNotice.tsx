import { MessageSquarePlus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../_components/Button";

type Tone = "warning" | "primary" | "neutral" | "danger";

const TONE_CLASS: Record<Tone, { box: string; icon: string }> = {
  warning: { box: "border-warning/30 bg-warning-soft", icon: "text-warning-text" },
  primary: { box: "border-primary/25 bg-primary-soft", icon: "text-primary-text" },
  neutral: { box: "border-rule bg-desk", icon: "text-ink-3" },
  danger: { box: "border-danger/25 bg-danger-soft", icon: "text-danger-text" },
};

type ChatNoticeProps = {
  tone: Tone;
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  /** Status notices are announced; errors interrupt */
  role?: "status" | "alert";
};

/** A state of the conversation the employee needs to know about. */
export function ChatNotice({
  tone,
  icon: Icon,
  title,
  children,
  action,
  role = "status",
}: ChatNoticeProps) {
  const classes = TONE_CLASS[tone];
  return (
    <div
      role={role}
      className={`flex flex-wrap items-start gap-3 rounded-[12px] border px-4 py-3 ${classes.box}`}
    >
      <Icon aria-hidden className={`mt-0.5 size-4.5 shrink-0 ${classes.icon}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-[13.5px] leading-normal">
        <p className="font-semibold text-ink">{title}</p>
        {children && <div className="text-ink-2">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export function NewConversationButton({ onClick }: { onClick(): void }) {
  return (
    <Button variant="secondary" onClick={onClick}>
      <MessageSquarePlus aria-hidden />
      Nova conversa
    </Button>
  );
}
