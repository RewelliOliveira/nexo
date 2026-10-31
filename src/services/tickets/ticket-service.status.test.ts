import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/client";
import { createTestDatabase } from "@/db/test-database";
import { InvalidStateError, NotFoundError } from "./errors";
import { createTicketService, nextStatuses, type TicketService } from "./ticket-service";

const NOW = new Date("2026-10-28T15:00:00Z");
const ANA = "emp-ana";
const OVERDUE_INC = "INC-20311";
const APPROVED_REQ = "REQ-10442";
const REOPENABLE = "INC-20150";
const PAST_WINDOW = "INC-19870";
const BRUNO_TICKET = "INC-20320";
const NOTE = "Marina Alves alterou o chamado";

let db: Database;
let service: TicketService;

beforeEach(async () => {
  db = await createTestDatabase(NOW);
  service = createTicketService({ db, now: () => NOW });
});

describe("analyst changing a ticket status", () => {
  it("moves the ticket and records it in the history", async () => {
    const ticket = await service.changeStatus(ANA, OVERDUE_INC, {
      status: "in_progress",
      note: NOTE,
    });

    expect(ticket.status).toBe("in_progress");
    expect(ticket.updates.at(-1)).toMatchObject({
      authorType: "analyst",
      kind: "status_change",
      content: NOTE,
    });
  });

  it("stamps the resolution, which stops the ticket being overdue", async () => {
    const ticket = await service.changeStatus(ANA, OVERDUE_INC, { status: "resolved", note: NOTE });

    expect(ticket.resolvedAt).toEqual(NOW);
    expect(ticket.isOverdue).toBe(false);
  });

  it("reopens a resolved ticket with a new deadline", async () => {
    const ticket = await service.changeStatus(ANA, REOPENABLE, {
      status: "in_progress",
      note: NOTE,
    });

    expect(ticket.resolvedAt).toBeNull();
    expect(ticket.dueAt.getTime()).toBeGreaterThan(NOW.getTime());
    expect(ticket.updates.at(-1)?.kind).toBe("reopened");
  });

  it("keeps the resolution date when a resolved ticket is closed", async () => {
    const before = await service.get(ANA, REOPENABLE);
    const ticket = await service.changeStatus(ANA, REOPENABLE, { status: "closed", note: NOTE });

    expect(ticket.resolvedAt).toEqual(before.resolvedAt);
  });

  it("refuses to reopen past the window, and anything after closed", async () => {
    await expect(
      service.changeStatus(ANA, PAST_WINDOW, { status: "open", note: NOTE }),
    ).rejects.toBeInstanceOf(InvalidStateError);

    await service.changeStatus(ANA, OVERDUE_INC, { status: "closed", note: NOTE });
    await expect(
      service.changeStatus(ANA, OVERDUE_INC, { status: "open", note: NOTE }),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("refuses to approve an incident or to repeat the current status", async () => {
    await expect(
      service.changeStatus(ANA, OVERDUE_INC, { status: "approved", note: NOTE }),
    ).rejects.toBeInstanceOf(InvalidStateError);
    await expect(
      service.changeStatus(ANA, APPROVED_REQ, { status: "approved", note: NOTE }),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("does not reach a ticket of another employee", async () => {
    await expect(
      service.changeStatus(ANA, BRUNO_TICKET, { status: "closed", note: NOTE }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("nextStatuses", () => {
  it("offers only what the service accepts", async () => {
    const pastWindow = await service.get(ANA, PAST_WINDOW);
    expect(nextStatuses(pastWindow, NOW)).toEqual(["closed"]);
    expect(nextStatuses({ ...pastWindow, status: "closed" }, NOW)).toEqual([]);

    const request = await service.get(ANA, APPROVED_REQ);
    expect(nextStatuses(request, NOW)).toEqual([
      "open",
      "in_progress",
      "awaiting_analyst",
      "resolved",
      "closed",
    ]);
  });
});
