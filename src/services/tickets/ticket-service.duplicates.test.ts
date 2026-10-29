import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/client";
import { tickets } from "@/db/schema";
import { createTestDatabase } from "@/db/test-database";
import { titleSimilarity } from "./duplicates";
import { DuplicateTicketError, InvalidStateError } from "./errors";
import { createTicketService, type TicketService } from "./ticket-service";
import type { CreateTicketInput } from "./types";

const NOW = new Date("2026-10-28T15:00:00Z");
const ANA = "emp-ana";
const CARLA = "emp-carla";

let db: Database;
let service: TicketService;

beforeEach(async () => {
  db = await createTestDatabase(NOW);
  service = createTicketService({ db, now: () => NOW });
});

function draft(overrides: Partial<CreateTicketInput>): CreateTicketInput {
  return {
    title: "Notebook muito lento depois da atualização",
    description: "O notebook continua lento e travando ao abrir planilhas.",
    type: "INC",
    category: "hardware",
    priority: "medium",
    affected: "Apenas eu",
    ...overrides,
  };
}

async function countTickets(employeeId: string): Promise<number> {
  const rows = await db
    .select()
    .from(tickets)
    .where(eq(tickets.employeeId, employeeId));
  return rows.length;
}

describe("titleSimilarity", () => {
  it("ignores accents, casing, stopwords and plurals", () => {
    expect(
      titleSimilarity("Notebook LENTO após atualizacao", "notebooks lentos depois da atualização"),
    ).toBe(1);
  });

  it("scores unrelated titles as zero", () => {
    expect(titleSimilarity("Mouse sem fio parou", "Notebook lento")).toBe(0);
  });
});

describe("duplicate tickets", () => {
  it("refuses to create a ticket when an active one covers the same problem", async () => {
    const before = await countTickets(ANA);

    const error = await service.create(ANA, draft({})).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DuplicateTicketError);
    expect((error as DuplicateTicketError).existing.map((t) => t.id)).toEqual([
      "INC-20311",
    ]);
    expect(await countTickets(ANA)).toBe(before);
  });

  it("allows updating the existing ticket instead", async () => {
    const updated = await service.update(ANA, "INC-20311", {
      comment: "Agora também trava ao abrir o Teams.",
    });

    expect(updated.updates.at(-1)?.content).toBe("Agora também trava ao abrir o Teams.");
  });

  it("creates a ticket for a different problem in the same category", async () => {
    const created = await service.create(
      ANA,
      draft({
        title: "Mouse sem fio parou de funcionar",
        description: "O mouse sem fio parou de responder mesmo com pilhas novas.",
        priority: "low",
      }),
    );

    expect(created.id).toMatch(/^INC-\d+$/);
    expect(created.status).toBe("open");
  });

  it("only checks the logged-in employee's tickets", async () => {
    // Bruno has an open ticket with this exact title; Carla does not
    const created = await service.create(
      CARLA,
      draft({ title: "Notebook lento após atualização do Windows" }),
    );

    expect(created.employeeId).toBe(CARLA);
  });

  it("offers a recently resolved ticket for reopening", async () => {
    const similar = await service.findSimilar(ANA, {
      title: "Senha do SAP bloqueada de novo",
      category: "access",
    });

    expect(similar.active).toEqual([]);
    expect(similar.reopenable.map((t) => t.id)).toEqual(["INC-20150"]);
  });

  it("does not offer tickets resolved more than 7 days ago", async () => {
    const similar = await service.findSimilar(ANA, {
      title: "VPN não conecta em casa",
      category: "network_vpn",
    });

    expect(similar.reopenable).toEqual([]);
    await expect(
      service.reopen(ANA, "INC-19870", { reason: "Voltou a acontecer" }),
    ).rejects.toBeInstanceOf(InvalidStateError);
  });

  it("treats a reopened ticket as active for duplicate checks", async () => {
    const reopened = await service.reopen(ANA, "INC-20150", {
      reason: "O SAP bloqueou novamente hoje.",
    });
    expect(reopened.status).toBe("open");

    await expect(
      service.create(
        ANA,
        draft({
          title: "Senha do SAP bloqueada",
          description: "Meu usuário do SAP bloqueou outra vez.",
          category: "access",
        }),
      ),
    ).rejects.toBeInstanceOf(DuplicateTicketError);
  });
});
