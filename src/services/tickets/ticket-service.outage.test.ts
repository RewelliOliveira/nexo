import { describe, expect, it } from "vitest";
import { createTestDatabase } from "@/db/test-database";
import { TicketServiceUnavailableError } from "./errors";
import { createTicketService } from "./ticket-service";

describe("legacy system outage", () => {
  it("stays down for the outage window and then recovers", async () => {
    let now = new Date("2026-10-28T15:00:00Z");
    const db = await createTestDatabase(now);
    const failures = [0, 1, 1];
    const service = createTicketService({
      db,
      now: () => now,
      failureRate: 0.5,
      outageMs: 3000,
      // First call fails, later calls would succeed on their own
      random: () => failures.shift() ?? 1,
    });

    await expect(service.list("emp-ana")).rejects.toBeInstanceOf(
      TicketServiceUnavailableError,
    );

    now = new Date(now.getTime() + 1000);
    await expect(service.list("emp-ana")).rejects.toMatchObject({
      code: "unavailable",
      retryAfterMs: 2000,
    });

    now = new Date(now.getTime() + 2000);
    await expect(service.list("emp-ana")).resolves.toHaveLength(2);
  });
});
