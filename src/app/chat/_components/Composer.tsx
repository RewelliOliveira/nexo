"use client";

import { ArrowUp } from "lucide-react";
import { useId, useImperativeHandle, useRef, useState, type Ref } from "react";

export type ComposerHandle = {
  /** Focuses the field, optionally with a hint, e.g. to correct a draft */
  focus(placeholder?: string): void;
};

type ComposerProps = {
  ref?: Ref<ComposerHandle>;
  /** Resolving to false puts the text back, e.g. when it was not delivered */
  onSend(text: string): void | Promise<boolean>;
  /** Called on each keystroke that leaves text in the field */
  onTyping?(): void;
  /** Busy: typing is allowed, sending waits */
  busy: boolean;
  /** Blocked for good (closed, limit): shows why instead */
  disabledReason?: string;
  placeholder?: string;
  /** Accessible name of the field */
  label?: string;
};

const DEFAULT_PLACEHOLDER = "Escreva para o Nexo…";

export function Composer({
  ref,
  onSend,
  onTyping,
  busy,
  disabledReason,
  placeholder: basePlaceholder = DEFAULT_PLACEHOLDER,
  label = "Mensagem para o Nexo Assist",
}: ComposerProps) {
  const [text, setText] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const disabled = disabledReason !== undefined;
  const canSend = !disabled && !busy && text.trim().length > 0;

  useImperativeHandle(ref, () => ({
    focus(placeholder) {
      if (placeholder) setHint(placeholder);
      inputRef.current?.focus();
    },
  }));

  function send() {
    if (!canSend) return;
    const sent = text.trim();
    setText("");
    setHint(null);
    void Promise.resolve(onSend(sent)).then((delivered) => {
      if (delivered === false) setText((current) => current || sent);
    });
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
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        id={id}
        ref={inputRef}
        rows={1}
        value={text}
        disabled={disabled}
        placeholder={disabledReason ?? hint ?? basePlaceholder}
        onChange={(event) => {
          setText(event.target.value);
          if (event.target.value.trim()) onTyping?.();
        }}
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
