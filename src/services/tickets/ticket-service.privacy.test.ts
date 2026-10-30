import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/client";
import { conversations, ticketUpdates, tickets } from "@/db/schema";
import { createTestDatabase } from "@/db/test-database";
import { NotFoundError } from "./errors";
import { createTicketService, type TicketService } from "./ticket-service";

const NOW = new Date("2026-10-28T15:00:00Z");
const ANA = "emp-ana";
const BRUNO = "emp-bruno";
// Tickets owned by Bruno in the seed
const BRUNO_TICKET = "INC-20320";
const ANA_RESOLVED_TICKET = "INC-20150";

let db: Database;
let service: TicketService;

beforeEach(async () => {
  db = await createTestDatabase(NOW);
  service = createTicketService({ db, now: () => NOW });
});

async function countUpdates(ticketId: string): Promise<number> {
  const rows = await db
    .select()
    .from(ticketUpdates)
    .where(eq(ticketUpdates.ticketId, ticketId));
  return rows.length;
}

async function createConversation(id: string, employeeId: string) {
  await db
    .insert(conversations)
    .values({ id, employeeId, createdAt: NOW, updatedAt: NOW });
}

describe("ticket privacy", () => {
  it("lists only the logged-in employee's tickets", async () => {
    const result = await service.list(ANA, { scope: "all" });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((ticket) => ticket.employeeId === ANA)).toBe(true);
    expect(result.map((ticket) => ticket.id)).not.toContain(BRUNO_TICKET);
  });

  it("returns an empty list for an employee without tickets", async () => {
    expect(await service.list("emp-diego", { scope: "all" })).toEqual([]);
  });

  it("treats another employee's ticket exactly like a missing one", async () => {
    const otherError = await service.get(ANA, BRUNO_TICKET).catch((e: unknown) => e);
    const missingError = await service.get(ANA, "INC-99999").catch((e: unknown) => e);

    expect(otherError).toBeInstanceOf(NotFoundError);
    expect(missingError).toBeInstanceOf(NotFoundError);
    expect((otherError as NotFoundError).code).toBe((missingError as NotFoundError).code);
  });

  it("does not let an employee update another employee's ticket", async () => {
    const before = await countUpdates(BRUNO_TICKET);

    await expect(
      service.update(ANA, BRUNO_TICKET, { comment: "Tentando alterar" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await countUpdates(BRUNO_TICKET)).toBe(before);
  });

  it("does not let an employee reopen another employee's ticket", async () => {
    await expect(
      service.reopen(BRUNO, ANA_RESOLVED_TICKET, { reason: "Voltou a acontecer" }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ANA_RESOLVED_TICKET));
    expect(ticket?.status).toBe("resolved");
  });

  it("does not show other employees' tickets as similar", async () => {
    const similar = await service.findSimilar(ANA, {
      title: "VPN com erro 809",
      category: "network_vpn",
    });

    expect(similar.active).toEqual([]);
  });

  it("does not hand off another employee's conversation", async () => {
    await createConversation("conv-bruno", BRUNO);

    await expect(
      service.handoff(ANA, {
        conversationId: "conv-bruno",
        reason: "employee_request",
        summary: "Funcionária pediu para falar com um analista.",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not attach another employee's ticket to a handoff", async () => {
    await createConversation("conv-ana", ANA);

    await expect(
      service.handoff(ANA, {
        conversationId: "conv-ana",
        reason: "overdue",
        summary: "Chamado vencido, funcionária pediu retorno.",
        ticketId: BRUNO_TICKET,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, "conv-ana"));
    expect(conversation?.status).toBe("with_agent");
  });
});
