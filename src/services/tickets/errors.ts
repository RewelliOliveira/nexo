import type { TicketSummary } from "./types";

export type TicketServiceErrorCode =
  | "not_found"
  | "invalid_input"
  | "invalid_state"
  | "duplicate"
  | "unavailable";

export class TicketServiceError extends Error {
  constructor(
    readonly code: TicketServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TicketServiceError";
  }
}

/**
 * Thrown both when the record does not exist and when it belongs to another
 * employee, so callers cannot probe for other people's tickets.
 */
export class NotFoundError extends TicketServiceError {
  constructor(entity: "ticket" | "conversation", id: string) {
    super("not_found", `${entity} ${id} not found`);
    this.name = "NotFoundError";
  }
}

export class InvalidStateError extends TicketServiceError {
  constructor(message: string) {
    super("invalid_state", message);
    this.name = "InvalidStateError";
  }
}

/**
 * Raised when the employee already has an active ticket about the same
 * problem: the existing ticket must be updated instead of duplicated.
 */
export class DuplicateTicketError extends TicketServiceError {
  constructor(readonly existing: TicketSummary[]) {
    super(
      "duplicate",
      `an active ticket about the same problem already exists: ${existing
        .map((ticket) => ticket.id)
        .join(", ")}`,
    );
    this.name = "DuplicateTicketError";
  }
}

/** The legacy ticket system is temporarily down. Safe to retry later. */
export class TicketServiceUnavailableError extends TicketServiceError {
  constructor(readonly retryAfterMs: number) {
    super("unavailable", "legacy ticket system is temporarily unavailable");
    this.name = "TicketServiceUnavailableError";
  }
}
