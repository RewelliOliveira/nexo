import { describe, expect, it, vi } from "vitest";
import { NotFoundError, TicketServiceUnavailableError } from "@/services/tickets";
import { withRetry } from "./retry";

describe("withRetry", () => {
  it("waits for the outage to end and tries again", async () => {
    const sleep = vi.fn(async () => {});
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TicketServiceUnavailableError(3000))
      .mockResolvedValueOnce("ok");

    await expect(withRetry(operation, { sleep })).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it("backs off exponentially when the service asks for a short wait", async () => {
    const sleep = vi.fn(async () => {});
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TicketServiceUnavailableError(100))
      .mockRejectedValueOnce(new TicketServiceUnavailableError(100))
      .mockResolvedValueOnce("ok");

    await withRetry(operation, { sleep, baseDelayMs: 500, maxAttempts: 3 });
    expect(sleep.mock.calls).toEqual([[500], [1000]]);
  });

  it("caps each wait", async () => {
    const sleep = vi.fn(async () => {});
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TicketServiceUnavailableError(60_000))
      .mockResolvedValueOnce("ok");

    await withRetry(operation, { sleep, maxDelayMs: 5000 });
    expect(sleep).toHaveBeenCalledWith(5000);
  });

  it("gives up after the last attempt", async () => {
    const sleep = vi.fn(async () => {});
    const operation = vi.fn(async () => {
      throw new TicketServiceUnavailableError(1000);
    });

    await expect(withRetry(operation, { sleep, maxAttempts: 3 })).rejects.toBeInstanceOf(
      TicketServiceUnavailableError,
    );
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry other errors", async () => {
    const sleep = vi.fn(async () => {});
    const operation = vi.fn(async () => {
      throw new NotFoundError("ticket", "INC-1");
    });

    await expect(withRetry(operation, { sleep })).rejects.toBeInstanceOf(NotFoundError);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
