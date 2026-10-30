import { ArrowRightLeft, Headset, ServerCrash, X, type LucideIcon } from "lucide-react";
import type { TicketStatus } from "@/lib/domain";
import { TicketStatusBadge, TicketStatusDot } from "../../_components/Badge";
import { formatDay, formatTime } from "../../_lib/format";
import {
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITY_LABEL,
  TICKET_STATUS_LABEL,
} from "../../_lib/labels";
import type { ConsoleTicket, ConversationDetail } from "../_lib/console-state";
import { firstName } from "../_lib/console-view";

const DONE_STATUSES: TicketStatus[] = ["resolved", "closed"];

type TicketPanelProps = {
  detail: ConversationDetail;
  onClose(): void;
};

/** The employee's tickets, starting with the one this conversation is about. */
export function TicketPanel({ detail, onClose }: TicketPanelProps) {
  const { conversation, tickets } = detail;
  const name = firstName(conversation.employee.name);
  const current = tickets?.find((ticket) => ticket.id === conversation.handoffTicketId);
  const others = sortTickets((tickets ?? []).filter((ticket) => ticket !== current));
  const done = (tickets ?? []).filter((ticket) => DONE_STATUSES.includes(ticket.status)).length;
  const open = (tickets?.length ?? 0) - done;

  return (
    <aside
      aria-label={`Chamados de ${conversation.employee.name}`}
      className="hidden w-85 shrink-0 flex-col border-l border-rule bg-paper xl:flex"
    >
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-rule pr-3.5 pl-5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="truncate text-[15.5px] font-semibold text-ink">Chamados de {name}</h2>
          {tickets && (
            <p className="text-[12.5px] text-ink-3">
              {plural(open, "aberto", "abertos")} · {plural(done, "encerrado", "encerrados")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-9 cursor-pointer items-center justify-center rounded-full text-ink-2 hover:bg-desk focus-visible:outline-2 focus-visible:outline-cta"
        >
          <X aria-hidden className="size-4.5" />
          <span className="sr-only">Fechar painel de chamados</span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-5 pt-6 pb-5">
        {tickets === null ? (
          <p
            role="status"
            className="flex items-start gap-2.5 rounded-[12px] border border-warning/30 bg-warning-soft px-3.5 py-3 text-[13px] text-ink-2"
          >
            <ServerCrash aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-text" />
            O sistema de chamados está fora do ar. Tentando de novo em instantes.
          </p>
        ) : (
          <>
            {current && (
              <section className="flex flex-col gap-3">
                <h3 className="text-[12.5px] font-semibold text-ink-3">Desta conversa</h3>
                <CurrentTicket ticket={current} detail={detail} />
              </section>
            )}
            <section className="flex flex-col gap-1">
              <h3 className="text-[12.5px] font-semibold text-ink-3">
                {current ? "Outros chamados" : "Chamados"}
              </h3>
              {others.length === 0 ? (
                <p className="py-3 text-[13.5px] text-ink-3">
                  {current ? "Nenhum outro chamado." : `${name} não tem chamados.`}
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-rule">
                  {others.map((ticket) => (
                    <TicketRow key={ticket.id} ticket={ticket} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}

function CurrentTicket({ ticket, detail }: { ticket: ConsoleTicket; detail: ConversationDetail }) {
  const event = lastEvent(detail);
  return (
    <article className="flex flex-col gap-3.5 rounded-[12px] bg-desk p-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[12.5px] font-medium text-ink-3">{ticket.id}</span>
          <TicketStatusBadge status={ticket.status} />
        </div>
        <p className="text-[15.5px] leading-snug font-semibold text-ink">{ticket.title}</p>
        <p className="text-[13.5px] text-ink-3">
          {TICKET_CATEGORY_LABEL[ticket.category]} · prioridade{" "}
          {TICKET_PRIORITY_LABEL[ticket.priority].toLowerCase()}
          {ticket.isOverdue && <span className="text-warning-text"> · vencido</span>}
        </p>
      </div>
      {event && (
        <p className="flex items-center gap-2 border-t border-rule pt-3 text-[13.5px] text-ink-2">
          <event.icon aria-hidden className="size-3.75 shrink-0 text-ink-3" />
          <span className="min-w-0 flex-1">{event.label}</span>
          <time className="text-[12.5px] text-ink-3">{formatTime(new Date(event.at))}</time>
        </p>
      )}
    </article>
  );
}

function TicketRow({ ticket }: { ticket: ConsoleTicket }) {
  const status =
    ticket.status === "resolved" && ticket.resolvedAt
      ? `Resolvido em ${formatDay(new Date(ticket.resolvedAt))}`
      : TICKET_STATUS_LABEL[ticket.status];
  return (
    <li className="flex items-center gap-3 py-3">
      <TicketStatusDot status={ticket.status} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.75">
        <p className="truncate text-[14.5px] font-medium text-ink">{ticket.title}</p>
        <p className="text-[12.5px] text-ink-3">
          {ticket.id} · {status}
          {ticket.isOverdue && <span className="text-warning-text"> · vencido</span>}
        </p>
      </div>
    </li>
  );
}

/** The latest thing that happened to the conversation: the handoff or an analyst action. */
function lastEvent(
  detail: ConversationDetail,
): { icon: LucideIcon; label: string; at: string } | null {
  const note = detail.messages.findLast((message) => message.role === "system");
  const handedOffAt = detail.conversation.handedOffAt;
  if (note && (!handedOffAt || note.createdAt >= handedOffAt)) {
    return { icon: Headset, label: note.content, at: note.createdAt };
  }
  return handedOffAt
    ? { icon: ArrowRightLeft, label: "Transferido para um analista", at: handedOffAt }
    : null;
}

/** Still open first, most recently updated on top. */
function sortTickets(tickets: ConsoleTicket[]): ConsoleTicket[] {
  return [...tickets].sort((a, b) => {
    const aDone = DONE_STATUSES.includes(a.status);
    const bDone = DONE_STATUSES.includes(b.status);
    if (aDone !== bDone) return aDone ? 1 : -1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
