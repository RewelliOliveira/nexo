import { describe, expect, it } from "vitest";
import { formatDateTime, formatDay, formatDeadline, formatRelative, formatTime } from "./format";

describe("format", () => {
  it("shows date and time in the company's time zone", () => {
    expect(formatDateTime(new Date("2026-10-16T17:20:00Z"))).toBe("16 out, 14:20");
  });

  it("describes how long ago something happened", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    expect(formatRelative(new Date("2026-10-16T12:00:00Z"), now)).toBe("há 5 dias");
    expect(formatRelative(new Date("2026-10-21T09:00:00Z"), now)).toBe("há 3 horas");
    expect(formatRelative(new Date("2026-10-21T11:59:30Z"), now)).toBe("agora");
  });

  it("shows the day or the time alone and deadlines without today's date", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    expect(formatDay(new Date("2026-10-16T17:20:00Z"))).toBe("16 out");
    expect(formatTime(new Date("2026-10-16T17:20:00Z"))).toBe("14:20");
    expect(formatDeadline(new Date("2026-10-21T16:43:00Z"), now)).toBe("13:43");
    expect(formatDeadline(new Date("2026-10-23T16:43:00Z"), now)).toBe("23 out, 13:43");
  });
});
