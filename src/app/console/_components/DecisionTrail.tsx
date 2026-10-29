"use client";

import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { DecisionDetails } from "../../chat/_components/AgentActions";
import { actionName } from "../../chat/_lib/action-labels";
import type { DecisionView } from "../../chat/_lib/chat-state";

type DecisionTrailProps = {
  decisions: DecisionView[];
};

/**
 * The decisions the agent recorded for one reply, as a line of actions with
 * the lowest confidence. Expanding shows intent, action, confidence and
 * reason of each, the same detail the employee sees.
 */
export function DecisionTrail({ decisions }: DecisionTrailProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const chosen = decisions.filter((decision) => decision.parentId === null);
  if (chosen.length === 0) return null;

  const lowest = Math.min(...chosen.map((decision) => decision.confidence));
  const blocked = chosen.some((decision) => decision.outcome && decision.outcome !== "success");
  return (
    <div className="flex w-full flex-col items-end gap-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="group flex max-w-full cursor-pointer flex-wrap items-center justify-end gap-x-2.5 gap-y-1 rounded-sm px-1.5 py-0.5 text-[12px] text-ink-3 hover:bg-paper/70 focus-visible:outline-2 focus-visible:outline-cta"
      >
        {chosen.map((decision) => (
          <span key={decision.id} className="flex items-center gap-1">
            {decision.outcome && decision.outcome !== "success" ? (
              <AlertTriangle aria-hidden className="size-3 text-warning" />
            ) : (
              <Check aria-hidden className="size-3" />
            )}
            {actionName(decision.action).toLowerCase()}
          </span>
        ))}
        <span className={lowest < 0.5 || blocked ? "font-medium text-warning-text" : undefined}>
          · confiança {Math.round(lowest * 100)}%
        </span>
        <span className="flex items-center gap-0.5 text-primary-text opacity-80 group-hover:opacity-100">
          {open ? "ocultar" : "decisões"}
          <ChevronDown
            aria-hidden
            className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <ol
          id={panelId}
          aria-label="Decisões do Nexo Assist nesta resposta"
          className="flex w-full max-w-130 flex-col divide-y divide-rule overflow-hidden rounded-[12px] border border-rule bg-paper text-left"
        >
          {chosen.map((decision) => (
            <li key={decision.id} className="flex flex-col">
              <DecisionDetails decision={decision} />
              {decisions
                .filter((child) => child.parentId === decision.id)
                .map((child) => (
                  <DecisionDetails key={child.id} decision={child} automatic />
                ))}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
