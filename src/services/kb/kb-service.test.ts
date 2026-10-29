import { beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "@/db/test-database";
import { createKbService, type KbService } from "./kb-service";

describe("kb service", () => {
  let kb: KbService;

  beforeEach(async () => {
    kb = createKbService({ db: await createTestDatabase(new Date()) });
  });

  it("finds the article that matches the employee's words", async () => {
    const results = await kb.search({ query: "a VPN está dando erro 809" });
    expect(results[0]?.id).toBe("KB-001");
  });

  it("ignores accents and plurals", async () => {
    const results = await kb.search({ query: "esqueci minhas senhas de REDE" });
    expect(results[0]?.id).toBe("KB-003");
  });

  it("filters by category", async () => {
    const results = await kb.search({ query: "senha", category: "access" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((article) => article.category === "access")).toBe(true);
  });

  it("returns nothing when no article is related", async () => {
    expect(await kb.search({ query: "férias e holerite" })).toEqual([]);
  });

  it("returns nothing for a query made only of stopwords", async () => {
    expect(await kb.search({ query: "o que é de" })).toEqual([]);
  });
});
