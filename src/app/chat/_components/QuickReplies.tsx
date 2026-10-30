"use client";

import { useEffect } from "react";

type QuickRepliesProps = {
  options: string[];
  /** The option the employee answered with, if any */
  chosen: string | null;
  interactive: boolean;
  onChoose(option: string): void;
};

/** Short answers the agent offered, sent as the employee's message. */
export function QuickReplies({ options, chosen, interactive, onChoose }: QuickRepliesProps) {
  // Number keys pick an option, unless the employee is typing
  useEffect(() => {
    if (!interactive) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable]")) {
        return;
      }
      const option = options[Number(event.key) - 1];
      if (option) {
        event.preventDefault();
        onChoose(option);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [interactive, options, onChoose]);

  if (!interactive && chosen === null) return null;

  return (
    <div role="group" aria-label="Respostas rápidas" className="flex flex-wrap gap-1.5">
      {options.map((option, index) => {
        const selected = option === chosen;
        return (
          <button
            key={option}
            type="button"
            disabled={!interactive}
            aria-pressed={selected}
            onClick={() => onChoose(option)}
            className={`flex cursor-pointer items-center gap-1.75 rounded-[8px] border px-3 py-1.75 text-[13.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta disabled:cursor-default ${
              selected
                ? "border-primary bg-primary-soft text-primary-text"
                : "border-rule bg-paper text-ink enabled:hover:bg-desk"
            }`}
          >
            {interactive && (
              <kbd
                aria-hidden
                className="flex size-4 items-center justify-center rounded-sm bg-desk font-ui text-[11.5px] text-ink-3"
              >
                {index + 1}
              </kbd>
            )}
            {option}
          </button>
        );
      })}
    </div>
  );
}
