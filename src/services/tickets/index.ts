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

let defaultService: TicketService | undefined;

/** Ticket service bound to the application database. */
export function getTicketService(): TicketService {
  defaultService ??= createTicketService({ db: getDatabase() });
  return defaultService;
}
