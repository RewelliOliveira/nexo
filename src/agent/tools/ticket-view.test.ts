import { describe, expect, it } from "vitest";
import { formatDateTime, parseDateTime } from "./ticket-view";

describe("ticket view dates", () => {
  it("reads back what it formats, to the minute", () => {
    const date = new Date("2026-10-28T17:05:00Z");
    expect(parseDateTime(formatDateTime(date))).toEqual(date);
  });

  it("uses Brasília time", () => {
    expect(parseDateTime("28/10/2026, 14:05")).toEqual(new Date("2026-10-28T17:05:00Z"));
    expect(parseDateTime("28/10/2026 14:05")).toEqual(new Date("2026-10-28T17:05:00Z"));
  });

  it("rejects anything else", () => {
    expect(parseDateTime("ontem")).toBeNull();
    expect(parseDateTime("2026-10-28")).toBeNull();
  });
});
