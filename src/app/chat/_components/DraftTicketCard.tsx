"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { parseDateTime, type TicketView } from "@/agent/tools/ticket-view";
import { PriorityBadge } from "../../_components/Badge";
import { Button } from "../../_components/Button";
import { formatDeadline } from "../../_lib/format";
import { TICKET_CATEGORY_LABEL, TICKET_TYPE_LABEL } from "../../_lib/labels";
import type { ToolDraft } from "../_lib/tool-parts";

export type DraftState =
  | { kind: "pending" }
  | { kind: "created"; ticketId: string }
  | { kind: "unused" };

type DraftTicketCardProps = {
  draft: ToolDraft;
  dueAtIfCreatedNow: string;
  /** Open tickets about the same problem: the agent offers to update them */
  similar: TicketView[];
  state: DraftState;
  /** Buttons are shown only on the latest reply, while the agent is free */
  interactive: boolean;
  now: Date;
  onConfirm(): void;
  onCorrect(): void;
  onCancel(): void;
};

const noSubscription = () => () => {};

/** Read after hydration, so the server and the first render agree. */
function useIsMac(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );
}

/** Ticket draft the employee checks before anything is created. */
export function DraftTicketCard({
  draft,
  dueAtIfCreatedNow,
  similar,
  state,
  interactive,
  now,
  onConfirm,
  onCorrect,
  onCancel,
}: DraftTicketCardProps) {
  const isMac = useIsMac();
  const actionable = interactive && state.kind === "pending";
  const dueAt = parseDateTime(dueAtIfCreatedNow);

  // Cmd/Ctrl + Enter confirms, as the shortcut on the button says
  useEffect(() => {
    if (!actionable) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onConfirm();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actionable, onConfirm]);

  return (
    <article
      aria-label="Rascunho do chamado"
      className="overflow-hidden rounded-2xl border border-ink/9 bg-paper shadow-[0_1px_2px_#1b24310d,0_6px_18px_#1b24310a]"
    >
      <div className="flex flex-col gap-1.5 px-4.5 pt-4 pb-3.5">
        <div className="flex items-center gap-2 pb-0.5 text-[12.5px] text-ink-3">
          <span className="font-medium">Novo chamado</span>
          <span aria-hidden className="size-0.75 rounded-full bg-rule" />
          <span>Rascunho · {TICKET_TYPE_LABEL[draft.type]}</span>
          <span className="ml-auto">
            <DraftStateLabel state={state} />
          </span>
        </div>
        <h3 className="text-lg leading-tight font-semibold tracking-[-0.2px] text-ink">
          {draft.title}
        </h3>
        <p className="text-[13.5px] leading-normal text-ink-2">{draft.description}</p>
      </div>

      <dl className="mx-4.5 mb-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-rule pt-3 sm:grid-cols-3">
        <Field label="Categoria">{TICKET_CATEGORY_LABEL[draft.category]}</Field>
        <Field label="Prioridade">
          <span className="flex flex-wrap items-center gap-x-1.5">
            <PriorityBadge priority={draft.priority} />
            {dueAt && (
              <span className="text-[13.5px] font-normal text-ink-3">
                · resposta até {formatDeadline(dueAt, now)}
              </span>
            )}
          </span>
        </Field>
        <Field label="Afetados">{draft.affected}</Field>
      </dl>

      {similar.length > 0 && (
        <p className="mx-4.5 mb-4 rounded-[8px] bg-warning-soft px-3 py-2 text-[13px] text-warning-text">
          Você já tem {similar.length === 1 ? "um chamado aberto parecido" : "chamados abertos parecidos"}:{" "}
          {similar.map((ticket) => ticket.id).join(", ")}. Em vez de abrir outro, dá para
          acrescentar a informação nele.
        </p>
      )}

      {actionable && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-rule bg-desk py-2 pr-3.5 pl-2">
          <Button onClick={onConfirm} className="pr-2.5">
            Confirmar
            <kbd className="rounded-sm bg-white/14 px-1.25 py-px font-ui text-[11.5px] text-white/80">
              {isMac ? "⌘↵" : "Ctrl ↵"}
            </kbd>
          </Button>
          <Button variant="secondary" onClick={onCorrect}>
            Editar
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      )}
    </article>
  );
}

function DraftStateLabel({ state }: { state: DraftState }) {
  if (state.kind === "created") {
    return (
      <span className="flex items-center gap-1.5 font-medium text-success-text">
        <span aria-hidden className="size-1.5 rounded-full bg-success" />
        Chamado aberto · {state.ticketId}
      </span>
    );
  }
  if (state.kind === "unused") {
    return <span className="text-ink-3">Rascunho não utilizado</span>;
  }
  return (
    <span className="flex items-center gap-1.5 font-medium text-warning-text">
      <span aria-hidden className="size-1.5 rounded-full bg-warning" />
      Aguardando confirmação
    </span>
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
