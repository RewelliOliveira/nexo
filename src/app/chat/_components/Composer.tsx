"use client";

import { ArrowUp } from "lucide-react";
import { useImperativeHandle, useRef, useState, type Ref } from "react";

export type ComposerHandle = {
  /** Focuses the field, optionally with a hint, e.g. to correct a draft */
  focus(placeholder?: string): void;
};

type ComposerProps = {
  ref?: Ref<ComposerHandle>;
  onSend(text: string): void;
  /** Agent busy: typing is allowed, sending waits */
  busy: boolean;
  /** Blocked for good (transferred, closed, limit): shows why instead */
  disabledReason?: string;
};

const DEFAULT_PLACEHOLDER = "Escreva para o Nexo…";

export function Composer({ ref, onSend, busy, disabledReason }: ComposerProps) {
  const [text, setText] = useState("");
  const [placeholder, setPlaceholder] = useState(DEFAULT_PLACEHOLDER);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const disabled = disabledReason !== undefined;
  const canSend = !disabled && !busy && text.trim().length > 0;

  useImperativeHandle(ref, () => ({
    focus(hint) {
      if (hint) setPlaceholder(hint);
      inputRef.current?.focus();
    },
  }));

  function send() {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
    setPlaceholder(DEFAULT_PLACEHOLDER);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      className={`flex min-h-12 items-end gap-2 rounded-[12px] border py-1.5 pr-1.5 pl-4 transition-colors ${
        disabled
          ? "border-rule bg-desk"
          : "border-ink/12 bg-paper focus-within:border-cta focus-within:ring-[0.5px] focus-within:ring-cta"
      }`}
    >
      <label htmlFor="composer" className="sr-only">
        Mensagem para o Nexo Assist
      </label>
      <textarea
        id="composer"
        ref={inputRef}
        rows={1}
        value={text}
        disabled={disabled}
        placeholder={disabledReason ?? placeholder}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            send();
          }
        }}
        className="field-sizing-content max-h-40 min-w-0 flex-1 resize-none self-center bg-transparent py-1.5 text-[14.5px] leading-normal text-ink outline-none placeholder:text-ink-3 disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={!canSend}
        className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm bg-cta px-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-cta/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ArrowUp aria-hidden className="size-3.5" />
        Enviar
      </button>
    </form>
  );
}
