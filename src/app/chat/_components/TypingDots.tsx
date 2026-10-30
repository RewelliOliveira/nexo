/** Three bouncing dots: someone is writing a reply. */
export function TypingDots() {
  return [0, 150, 300].map((delay) => (
    <span
      key={delay}
      aria-hidden
      style={{ animationDelay: `${delay}ms` }}
      className="size-1.5 animate-bounce rounded-full bg-ink-3/60"
    />
  ));
}
