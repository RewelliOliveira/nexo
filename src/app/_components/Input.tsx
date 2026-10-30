"use client";

import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";

type InputProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  /** Shown at the right of the label, e.g. a "forgot password" link */
  labelAction?: ReactNode;
  icon?: LucideIcon;
  error?: string;
};

/** Labeled text field. Password fields get a show/hide toggle. */
export function Input({
  label,
  labelAction,
  icon: Icon,
  error,
  type = "text",
  className = "",
  ...props
}: InputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[13.5px] font-medium text-ink">
          {label}
        </label>
        {labelAction}
      </div>
      <div
        className={`group flex h-11 items-center gap-2.5 rounded-[8px] border bg-paper pr-2 pl-3.5 transition-colors focus-within:shadow-none focus-within:ring-[0.5px] ${
          error
            ? "border-danger ring-danger focus-within:ring-danger"
            : "border-ink/12 shadow-[0_1px_2px_#1b24310a] focus-within:border-cta focus-within:ring-cta"
        }`}
      >
        {Icon && (
          <Icon
            aria-hidden
            className="size-4 shrink-0 text-ink-3 group-focus-within:text-primary-text"
          />
        )}
        <input
          id={id}
          type={isPassword && revealed ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-subtle [&[type=password]:not(:placeholder-shown)]:tracking-[2px]"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={revealed}
            className="flex size-7.5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-ink-3 hover:bg-desk focus-visible:outline-2 focus-visible:outline-cta"
          >
            {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-[12.5px] text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
