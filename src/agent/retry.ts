import { TicketServiceUnavailableError } from "@/services/tickets";

export type RetryOptions = {
  /** Total attempts, including the first call */
  maxAttempts?: number;
  /** Delay before the first retry; doubles on each attempt */
  baseDelayMs?: number;
  /** Upper bound for a single wait, so the employee is not left hanging */
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 5000;

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Retries an operation while the legacy ticket system is down. Waits at least
 * as long as the service asks (`retryAfterMs`), with exponential backoff.
 * Any other error, or the last unavailable error, is rethrown.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    sleep = defaultSleep,
  }: RetryOptions = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof TicketServiceUnavailableError) || attempt >= maxAttempts) {
        throw error;
      }
      const backoff = baseDelayMs * 2 ** (attempt - 1);
      await sleep(Math.min(Math.max(error.retryAfterMs, backoff), maxDelayMs));
    }
  }
}
