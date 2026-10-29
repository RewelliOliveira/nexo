import { useEffect, useEffectEvent } from "react";

/** How often the console asks the server for news. Polling is enough here. */
export const POLL_INTERVAL_MS = 4000;

/**
 * Calls `poll` every few seconds while the tab is visible, and right away
 * when the analyst comes back to it.
 */
export function usePolling(poll: () => void, intervalMs = POLL_INTERVAL_MS): void {
  const onTick = useEffectEvent(poll);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") onTick();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") onTick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
}
