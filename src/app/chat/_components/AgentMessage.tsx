import type { UIMessage } from "ai";
import type { ReactNode } from "react";
import { RichText } from "./RichText";

type AgentMessageProps = {
  message: UIMessage;
};

/** A reply of Nexo Assist: who answered, then its text. */
export function AgentMessage({ message }: AgentMessageProps) {
  const texts = message.parts.flatMap((part) =>
    part.type === "text" && part.text.trim() ? [part.text] : [],
  );
  return (
    <article className="flex flex-col gap-1.5">
      <AgentHeader />
      {texts.map((text, index) => (
        <AgentBubble key={index}>
          <RichText text={text} />
        </AgentBubble>
      ))}
    </article>
  );
}

export function AgentHeader({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
      <span className="font-semibold text-ink">Nexo Assist</span>
      {children}
    </div>
  );
}

export function AgentBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-fit max-w-150 flex-col gap-3 rounded-[4px_12px_12px_12px] border border-rule bg-paper px-4 py-3 text-[14.5px] leading-normal text-ink">
      {children}
    </div>
  );
}

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-130 rounded-[12px_12px_4px_12px] bg-ink px-4 py-2.75 text-[14.5px] leading-[1.45] whitespace-pre-wrap text-white">
        {text}
      </p>
    </div>
  );
}

/** Shown while the agent has not written anything yet. */
export function AgentThinking() {
  return (
    <div role="status" className="flex flex-col gap-1.5">
      <AgentHeader>
        <span className="text-ink-3">pensando…</span>
      </AgentHeader>
      <div className="flex h-11 w-fit items-center gap-1 rounded-[4px_12px_12px_12px] border border-rule bg-paper px-4">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            aria-hidden
            style={{ animationDelay: `${delay}ms` }}
            className="size-1.5 animate-bounce rounded-full bg-ink-3/60"
          />
        ))}
        <span className="sr-only">O Nexo Assist está respondendo</span>
      </div>
    </div>
  );
}
