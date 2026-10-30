import { describe, expect, it } from "vitest";
import { computeDueAt, isOverdue } from "./sla";

// 2026-10-28 is a Wednesday; times below are in UTC (local time is UTC-3)
const wednesdayAt10Local = new Date("2026-10-28T13:00:00Z");
const fridayAt16Local = new Date("2026-10-30T19:00:00Z");

describe("computeDueAt", () => {
  it("gives critical tickets one calendar hour", () => {
    expect(computeDueAt("critical", fridayAt16Local).toISOString()).toBe(
      "2026-10-30T20:00:00.000Z",
    );
  });

  it("counts high priority in business hours across the weekend", () => {
    // Friday 16h + 2h left that day + 2h on Monday from 8h = Monday 10h local
    expect(computeDueAt("high", fridayAt16Local).toISOString()).toBe(
      "2026-11-02T13:00:00.000Z",
    );
  });

  it("gives medium priority three business days", () => {
    expect(computeDueAt("medium", wednesdayAt10Local).toISOString()).toBe(
      "2026-11-02T13:00:00.000Z",
    );
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  const past = new Date("2026-10-29T11:00:00Z");

  it("flags active tickets past the deadline", () => {
    expect(isOverdue({ status: "open", dueAt: past }, now)).toBe(true);
  });

  it("never flags resolved tickets", () => {
    expect(isOverdue({ status: "resolved", dueAt: past }, now)).toBe(false);
  });
});
