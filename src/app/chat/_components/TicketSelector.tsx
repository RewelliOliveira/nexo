import { parseDateTime, type TicketView } from "@/agent/tools/ticket-view";
import { TicketStatusBadge } from "../../_components/Badge";
import { formatDay } from "../../_lib/format";

type TicketSelectorProps = {
  tickets: TicketView[];
  /** Ticket the employee already picked, if any */
  selectedId: string | null;
  /** False once the conversation moved on or the agent is busy */
  interactive: boolean;
  onSelect(ticket: TicketView): void;
};

/** The employee's tickets as a list to pick the one they mean. */
export function TicketSelector({
  tickets,
  selectedId,
  interactive,
  onSelect,
}: TicketSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Escolha o chamado"
      className="flex flex-col divide-y divide-rule overflow-hidden rounded-2xl border border-ink/9 bg-paper shadow-[0_1px_2px_#1b24310d,0_6px_18px_#1b24310a]"
    >
      {tickets.map((ticket) => {
        const selected = ticket.id === selectedId;
        const createdAt = parseDateTime(ticket.createdAt);
        return (
          <button
            key={ticket.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!interactive}
            onClick={() => onSelect(ticket)}
            className={`flex min-h-11.5 cursor-pointer items-center gap-3.5 px-4 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cta enabled:hover:bg-desk disabled:cursor-default ${
              selected ? "bg-cta/4" : ""
            }`}
          >
            <span
              aria-hidden
              className={`flex size-4 shrink-0 items-center justify-center rounded-full border bg-paper ${
                selected ? "border-cta" : "border-ink/20"
              }`}
            >
              {selected && <span className="size-2 rounded-full bg-cta" />}
            </span>
            <span className="shrink-0 text-[12.5px] font-medium text-ink-3">{ticket.id}</span>
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-ink">
              {ticket.title}
            </span>
            <span className="hidden sm:inline">
              <TicketStatusBadge status={ticket.status} muted />
            </span>
            {createdAt && (
              <span className="hidden w-11 shrink-0 text-right text-[12.5px] text-ink-3 sm:inline">
                {formatDay(createdAt)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
