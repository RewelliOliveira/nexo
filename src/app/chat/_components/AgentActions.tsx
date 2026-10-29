"use client";

import { AlertTriangle, Check, ChevronDown, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { actionLabels, actionName } from "../_lib/action-labels";
import type { DecisionOutcome, DecisionView } from "../_lib/chat-state";
import { decisionIdOf, type ToolCall } from "../_lib/tool-parts";

export type DecisionIndex = {
  byId: ReadonlyMap<string, DecisionView>;
  /** System decisions taken inside a call, by the call's decision id */
  byParent: ReadonlyMap<string, DecisionView[]>;
};

type AgentActionsProps = {
  calls: ToolCall[];
  decisions: DecisionIndex;
};

/**
 * What the agent did for this reply, as a line of short labels. Expanding
 * it shows each recorded decision: intent, action, confidence and reason.
 */
export function AgentActions({ calls, decisions }: AgentActionsProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (calls.length === 0) return null;

  const running = calls.some((call) => call.state === "running");
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={running}
        onClick={() => setOpen((value) => !value)}
        className="group -mx-1.5 flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-sm px-1.5 py-0.5 text-left text-ink-3 hover:bg-desk focus-visible:outline-2 focus-visible:outline-cta disabled:cursor-default disabled:hover:bg-transparent"
      >
        {calls.flatMap((call) =>
          actionLabels(call).map((label, index) => (
            <span key={`${call.toolCallId}-${index}`} className="flex items-center gap-1.25">
              <ActionIcon state={call.state} />
              <span className={call.state === "failed" ? "text-warning-text" : undefined}>
                {label}
              </span>
            </span>
          )),
        )}
        {!running && (
          <span className="flex items-center gap-0.5 text-[12px] text-primary-text opacity-80 group-hover:opacity-100">
            {open ? "ocultar" : "por quê?"}
            <ChevronDown
              aria-hidden
              className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </span>
        )}
      </button>

      {open && (
        <ol
          id={panelId}
          aria-label="Decisões do Nexo Assist nesta resposta"
          className="flex w-full max-w-150 basis-full flex-col divide-y divide-rule overflow-hidden rounded-[12px] border border-rule bg-desk"
        >
          {calls.map((call) => {
            const decisionId = decisionIdOf(call);
            const decision = decisionId ? decisions.byId.get(decisionId) : undefined;
            const automatic = decisionId ? (decisions.byParent.get(decisionId) ?? []) : [];
            return (
              <li key={call.toolCallId} className="flex flex-col">
                <DecisionDetails call={call} decision={decision} />
                {automatic.map((child) => (
                  <DecisionDetails key={child.id} decision={child} automatic />
                ))}
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

function ActionIcon({ state }: { state: ToolCall["state"] }) {
  if (state === "running") {
    return <Loader2 aria-hidden className="size-3 animate-spin text-primary-text" />;
  }
  if (state === "failed") {
    return <AlertTriangle aria-hidden className="size-3 text-warning" />;
  }
  return <Check aria-hidden className="size-3" />;
}

const OUTCOME_LABEL: Record<DecisionOutcome, string> = {
  success: "Concluída",
  rejected: "Bloqueada pela regra",
  failed: "Não concluída",
};

const OUTCOME_CLASS: Record<DecisionOutcome, string> = {
  success: "bg-success-soft text-success-text",
  rejected: "bg-warning-soft text-warning-text",
  failed: "bg-danger-soft text-danger-text",
};

type DecisionDetailsProps = {
  decision: DecisionView | undefined;
  call?: ToolCall;
  /** Taken by the system inside the call, not chosen by the model */
  automatic?: boolean;
};

function DecisionDetails({ decision, call, automatic = false }: DecisionDetailsProps) {
  const title = actionName(decision?.action ?? call?.toolName ?? "");
  return (
    <div className={`flex flex-col gap-2.5 px-4 py-3 text-[13px] ${automatic ? "pl-8" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink">{title}</span>
        {automatic && <span className="text-ink-3">· automática, pela regra de chamado crítico</span>}
        {decision?.outcome && (
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[11.5px] font-medium ${OUTCOME_CLASS[decision.outcome]}`}
          >
            {OUTCOME_LABEL[decision.outcome]}
          </span>
        )}
      </div>

      {decision ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-ink-3">Intenção entendida</dt>
          <dd className="text-ink">{decision.intent}</dd>
          <dt className="text-ink-3">Ação</dt>
          <dd>
            <code className="rounded-[4px] bg-paper px-1.5 py-0.5 font-data text-[12px] text-ink-2">
              {decision.action}
            </code>
          </dd>
          <dt className="text-ink-3">Confiança</dt>
          <dd>
            <Confidence value={decision.confidence} />
          </dd>
          <dt className="text-ink-3">Motivo</dt>
          <dd className="text-ink">{decision.reason}</dd>
        </dl>
      ) : (
        <p className="text-ink-3">
          {call && call.state !== "running" && decisionIdOf(call) === null
            ? "Sem registro: o sistema recusou o pedido antes de executar a ação."
            : "Registrando a decisão…"}
        </p>
      )}
    </div>
  );
}

function Confidence({ value }: { value: number }) {
  const percent = Math.round(value * 100);
  const tone = value >= 0.8 ? "bg-success" : value >= 0.5 ? "bg-warning" : "bg-danger";
  return (
    <span className="flex items-center gap-2">
      <span
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Confiança"
        className="h-1.5 w-20 overflow-hidden rounded-full bg-rule"
      >
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </span>
      <span className="font-data text-[12px] text-ink">{percent}%</span>
    </span>
  );
}
