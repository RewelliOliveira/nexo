import { Headset } from "lucide-react";
import { formatTime } from "../../_lib/format";
import type { ServiceDeskMessage as ServiceDeskMessageData } from "../_lib/chat-state";
import { UserMessage } from "./AgentMessage";
import { RichText } from "./RichText";
import { TypingDots } from "./TypingDots";

/** Shown while the analyst writes a reply. */
export function AnalystTyping({ name }: { name: string }) {
  return (
    <div role="status" className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
        <span className="font-semibold text-ink">{name}</span>
        <span className="rounded-sm bg-success-soft px-1.5 py-px text-[11px] font-semibold text-success-text">
          Service desk
        </span>
        <span className="text-ink-3">digitando…</span>
      </div>
      <div className="flex h-11 w-fit items-center gap-1 rounded-[4px_12px_12px_12px] bg-[#E3F4EA] px-4">
        <TypingDots />
        <span className="sr-only">{name} está digitando</span>
      </div>
    </div>
  );
}

/** A message exchanged with the analyst, or a note of the service desk. */
export function ServiceDeskMessage({ message }: { message: ServiceDeskMessageData }) {
  const time = formatTime(new Date(message.createdAt));
  switch (message.role) {
    case "employee":
      return <UserMessage text={message.content} />;
    case "analyst":
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
            <span className="font-semibold text-ink">{message.authorName ?? "Analista"}</span>
            <span className="rounded-sm bg-success-soft px-1.5 py-px text-[11px] font-semibold text-success-text">
              Service desk
            </span>
            <time dateTime={message.createdAt} className="text-ink-3">
              {time}
            </time>
          </div>
          <div className="flex w-fit max-w-150 flex-col rounded-[4px_12px_12px_12px] bg-[#E3F4EA] px-4 py-3 text-[14.5px] leading-normal text-ink">
            <RichText text={message.content} />
          </div>
        </div>
      );
    default:
      return (
        <div role="note" className="flex items-center gap-3 py-1">
          <span aria-hidden className="h-px flex-1 bg-ink/8" />
          <span className="flex items-center gap-1.5 text-center text-[12px] font-medium text-ink-3">
            <Headset aria-hidden className="size-3.25 shrink-0" />
            {message.content} · {time}
          </span>
          <span aria-hidden className="h-px flex-1 bg-ink/8" />
        </div>
      );
  }
}
