import type { TicketPriority, TicketStatus } from "@/db/schema";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Service desk hours: Monday to Friday, 8h to 18h, Brasília time (UTC-3, no DST)
const UTC_OFFSET_HOURS = -3;
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 18;
const BUSINESS_HOURS_PER_DAY = BUSINESS_END_HOUR - BUSINESS_START_HOUR;

/**
 * SLA per priority (Annex A). Critical tickets have a 24h on-call team, so
 * their deadline runs on calendar time; the others count business hours only.
 */
export const SLA_BY_PRIORITY: Record<
  TicketPriority,
  { hours: number; businessHours: boolean }
> = {
  critical: { hours: 1, businessHours: false },
  high: { hours: 4, businessHours: true },
  medium: { hours: 3 * BUSINESS_HOURS_PER_DAY, businessHours: true },
  low: { hours: 5 * BUSINESS_HOURS_PER_DAY, businessHours: true },
};

export const ACTIVE_STATUSES: readonly TicketStatus[] = [
  "open",
  "in_progress",
  "awaiting_analyst",
  "approved",
];

export function isActiveStatus(status: TicketStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function computeDueAt(priority: TicketPriority, from: Date): Date {
  const sla = SLA_BY_PRIORITY[priority];
  if (!sla.businessHours) {
    return new Date(from.getTime() + sla.hours * HOUR);
  }
  return addBusinessHours(from, sla.hours);
}

export function isOverdue(
  ticket: { status: TicketStatus; dueAt: Date },
  now: Date,
): boolean {
  return isActiveStatus(ticket.status) && ticket.dueAt.getTime() < now.getTime();
}

/** Adds working time, skipping nights and weekends. */
export function addBusinessHours(from: Date, hours: number): Date {
  // Work on a shifted clock so getUTC* methods return local (UTC-3) values
  const offset = UTC_OFFSET_HOURS * HOUR;
  let cursor = new Date(from.getTime() + offset);
  let remaining = hours * HOUR;

  while (remaining > 0) {
    cursor = moveToBusinessTime(cursor);
    const endOfDay = new Date(cursor);
    endOfDay.setUTCHours(BUSINESS_END_HOUR, 0, 0, 0);
    const available = endOfDay.getTime() - cursor.getTime();

    if (remaining <= available) {
      cursor = new Date(cursor.getTime() + remaining);
      remaining = 0;
    } else {
      remaining -= available;
      cursor = endOfDay;
    }
  }

  return new Date(cursor.getTime() - offset);
}

function moveToBusinessTime(date: Date): Date {
  const next = new Date(date);
  if (next.getUTCHours() >= BUSINESS_END_HOUR) {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0);
  } else if (next.getUTCHours() < BUSINESS_START_HOUR) {
    next.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0);
  }
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0);
  }
  return next;
}
