import path from "node:path";
import { describe, expect, it } from "vitest";
import { getProjectRoot, resolveDatabaseUrl } from "./project-root";

const ROOT = path.join(path.parse(process.cwd()).root, "work", "nexo");
const isRoot = (target: string) => target === path.join(ROOT, "src", "db", "migrations");

describe("getProjectRoot", () => {
  it("is the cwd for the Next app", () => {
    expect(getProjectRoot(ROOT, isRoot)).toBe(ROOT);
  });

  it("walks up from the folders mastra dev runs in", () => {
    expect(getProjectRoot(path.join(ROOT, ".mastra", "output"), isRoot)).toBe(ROOT);
    expect(getProjectRoot(path.join(ROOT, "src", "mastra", "public"), isRoot)).toBe(ROOT);
  });

  it("falls back to the cwd outside the project", () => {
    const elsewhere = path.join(path.parse(process.cwd()).root, "tmp");
    expect(getProjectRoot(elsewhere, isRoot)).toBe(elsewhere);
  });
});

describe("resolveDatabaseUrl", () => {
  it("resolves relative file urls against the root with forward slashes", () => {
    const expected = `file:${path.join(ROOT, "nexo.db").replaceAll("\\", "/")}`;
    expect(resolveDatabaseUrl("file:nexo.db", ROOT)).toBe(expected);
    expect(resolveDatabaseUrl("file:./nexo.db", ROOT)).toBe(expected);
  });

  it("keeps remote and in-memory urls", () => {
    expect(resolveDatabaseUrl("libsql://nexo.turso.io", ROOT)).toBe("libsql://nexo.turso.io");
    expect(resolveDatabaseUrl(":memory:", ROOT)).toBe(":memory:");
    expect(resolveDatabaseUrl("file::memory:", ROOT)).toBe("file::memory:");
  });
});
