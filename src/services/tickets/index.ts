import { getDatabase } from "@/db/client";
import { createTicketService, type TicketService } from "./ticket-service";

export * from "./errors";
export * from "./types";
export { computeDueAt, isOverdue, SLA_BY_PRIORITY } from "./sla";
export {
  createTicketService,
  REOPEN_WINDOW_DAYS,
  type TicketService,
  type TicketServiceOptions,
} from "./ticket-service";

const DEFAULT_FAILURE_RATE = 0.1;

let defaultService: TicketService | undefined;

/** Ticket service bound to the application database. */
export function getTicketService(): TicketService {
  defaultService ??= createTicketService({
    db: getDatabase(),
    failureRate: readFailureRate(process.env.TICKET_SERVICE_FAILURE_RATE),
  });
  return defaultService;
}

function readFailureRate(value: string | undefined): number {
  const rate = Number(value);
  if (value === undefined || value === "" || Number.isNaN(rate)) {
    return DEFAULT_FAILURE_RATE;
  }
  return Math.min(Math.max(rate, 0), 1);
}
