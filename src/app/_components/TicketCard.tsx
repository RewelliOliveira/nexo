import type { ReactNode } from "react";
import type { TicketSummary } from "@/services/tickets";
import { formatDateTime, formatRelative } from "../_lib/format";
import { TICKET_CATEGORY_LABEL } from "../_lib/labels";
import { PriorityBadge, TicketStatusBadge } from "./Badge";

/** What the card shows; the description is optional in compact results. */
export type TicketCardTicket = Pick<
  TicketSummary,
  "id" | "title" | "status" | "category" | "priority" | "createdAt" | "updatedAt" | "isOverdue"
> & { description?: string };

type TicketCardProps = {
  ticket: TicketCardTicket;
  /** Reference time for "há 5 dias"; passed in so rendering stays pure */
  now: Date;
  /** Buttons shown in the card footer, e.g. confirm / edit / cancel */
  actions?: ReactNode;
};

export function TicketCard({ ticket, now, actions }: TicketCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-ink/9 bg-paper shadow-[0_1px_2px_#1b24310d,0_6px_18px_#1b24310a]">
      <div className="flex flex-col gap-1.5 px-4.5 pt-4 pb-3.5">
        <div className="flex items-center gap-2 pb-0.5 text-[12.5px] text-ink-3">
          <span className="font-medium">Chamado</span>
          <span aria-hidden className="size-0.75 rounded-full bg-rule" />
          <span>{ticket.id}</span>
          <span className="ml-auto">
            <TicketStatusBadge status={ticket.status} />
          </span>
        </div>
        <h3 className="text-lg leading-tight font-semibold tracking-[-0.2px] text-ink">
          {ticket.title}
        </h3>
        {ticket.description && (
          <p className="text-[13.5px] leading-normal text-ink-2">{ticket.description}</p>
        )}
      </div>

      <dl className="mx-4.5 mb-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-rule pt-3 sm:grid-cols-4">
        <Field label="Categoria">{TICKET_CATEGORY_LABEL[ticket.category]}</Field>
        <Field label="Prioridade">
          <PriorityBadge priority={ticket.priority} />
        </Field>
        <Field label="Aberto em">{formatDateTime(ticket.createdAt)}</Field>
        <Field label="Última atualização">
          <span className={ticket.isOverdue ? "text-warning-text" : undefined}>
            {formatRelative(ticket.updatedAt, now)}
          </span>
          {ticket.isOverdue && (
            <span className="text-[13.5px] font-normal text-ink-3"> · prazo vencido</span>
          )}
        </Field>
      </dl>

      {actions && (
        <div className="flex items-center gap-1.5 border-t border-rule bg-desk py-2 pr-3.5 pl-2">
          {actions}
        </div>
      )}
    </article>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[12.5px] text-ink-3">{label}</dt>
      <dd className="text-[14.5px] font-medium text-ink">{children}</dd>
    </div>
  );
}
