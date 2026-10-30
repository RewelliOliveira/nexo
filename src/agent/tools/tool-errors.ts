import { z } from "zod";
import { ConversationNotFoundError } from "@/services/conversations";
import {
  DuplicateTicketError,
  NotFoundError,
  TicketServiceError,
  TicketServiceUnavailableError,
} from "@/services/tickets";
import { toTicketView } from "./ticket-view";

export const toolErrorSchema = z.object({
  code: z.string(),
  /** Written for the model, which rephrases it to the employee */
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type ToolError = z.infer<typeof toolErrorSchema>;

/** A rule of the service desk refused the call. Not a bug: the model must adapt. */
export class ToolRejection extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ToolRejection";
  }
}

/** Turns any failure into an error the model can explain to the employee. */
export function toToolError(error: unknown): ToolError {
  if (error instanceof ToolRejection) {
    return { code: error.code, message: error.message, details: error.details };
  }
  if (error instanceof TicketServiceUnavailableError) {
    return {
      code: "service_unavailable",
      message:
        "O sistema de chamados está fora do ar há alguns segundos e não respondeu mesmo após novas tentativas. Avise o funcionário que nada foi perdido e peça para tentar novamente em instantes.",
    };
  }
  if (error instanceof NotFoundError || error instanceof ConversationNotFoundError) {
    return {
      code: "not_found",
      message:
        "Não existe chamado com esse número entre os chamados deste funcionário. Não diga se ele existe para outra pessoa.",
    };
  }
  if (error instanceof DuplicateTicketError) {
    return {
      code: "duplicate",
      message:
        "Já existe um chamado aberto deste funcionário sobre o mesmo problema. Ofereça atualizar o chamado existente em vez de criar outro.",
      details: { existingTickets: error.existing.map(toTicketView) },
    };
  }
  // invalid_state and invalid_input: the message says what to fix
  if (error instanceof TicketServiceError) {
    return { code: error.code, message: error.message };
  }
  console.error("[nexo-assist] unexpected tool error", error);
  return {
    code: "unexpected_error",
    message:
      "Ocorreu um erro inesperado ao executar a ação. Peça desculpas e ofereça transferir para um analista.",
  };
}
