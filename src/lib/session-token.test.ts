import { describe, expect, it } from "vitest";
import { readSessionSecret, signSessionToken, verifySessionToken } from "./session-token";

const SECRET = "test-secret-with-at-least-32-characters!";
const NOW = new Date("2026-10-29T12:00:00Z");
const PAYLOAD = { sub: "emp-ana", exp: NOW.getTime() + 60_000 };

describe("session token", () => {
  it("round-trips a valid token", () => {
    const token = signSessionToken(PAYLOAD, SECRET);
    expect(verifySessionToken(token, SECRET, NOW)).toEqual(PAYLOAD);
  });

  it("rejects a token signed with another secret", () => {
    const token = signSessionToken(PAYLOAD, "another-secret-with-at-least-32-chars");
    expect(verifySessionToken(token, SECRET, NOW)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const [, signature] = signSessionToken(PAYLOAD, SECRET).split(".");
    const forged = Buffer.from(JSON.stringify({ ...PAYLOAD, sub: "emp-marina" })).toString(
      "base64url",
    );
    expect(verifySessionToken(`${forged}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("rejects the old plain employee id cookie and malformed tokens", () => {
    for (const token of ["emp-ana", "", "a.b.c", "."]) {
      expect(verifySessionToken(token, SECRET, NOW)).toBeNull();
    }
  });

  it("rejects an expired token", () => {
    const token = signSessionToken({ ...PAYLOAD, exp: NOW.getTime() }, SECRET);
    expect(verifySessionToken(token, SECRET, NOW)).toBeNull();
  });

  it("requires a long enough secret", () => {
    expect(() => readSessionSecret(undefined)).toThrow(/SESSION_SECRET/);
    expect(() => readSessionSecret("short")).toThrow(/SESSION_SECRET/);
    expect(readSessionSecret(SECRET)).toBe(SECRET);
  });
});
