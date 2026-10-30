"use server";

import { z } from "zod";
import { withRetry } from "@/agent/retry";
import { TICKET_STATUSES, type TicketStatus } from "@/lib/domain";
import {
  ConversationNotFoundError,
  ConversationStateError,
  getConsoleService,
  type Analyst,
  type ConsoleService,
} from "@/services/conversations";
import {
  getTicketService,
  InvalidStateError,
  NotFoundError,
  TicketServiceUnavailableError,
} from "@/services/tickets";
import { TICKET_STATUS_LABEL } from "../_lib/labels";
import { getAnalystSession } from "./_lib/analyst-session";
import type { ConsoleError } from "./_lib/console-state";

export type ConsoleActionResult = { ok: true } | { ok: false; error: ConsoleError };

const conversationIdSchema = z.string().trim().min(1).max(100);

/** Longest reply the analyst can send at once. */
const MAX_REPLY_LENGTH = 4000;

const replySchema = z.string().trim().min(1).max(MAX_REPLY_LENGTH);

const ticketChangeSchema = z.object({
  ticketId: z.string().trim().min(1).max(100),
  status: z.enum(TICKET_STATUSES),
});

/** Takes the conversation: the agent stops answering it. */
export async function assumeConversation(conversationId: string): Promise<ConsoleActionResult> {
  return run(conversationId, (service, id, analyst) => service.assume(id, analyst));
}

/** Hands the conversation back to Nexo Assist. */
export async function releaseConversation(conversationId: string): Promise<ConsoleActionResult> {
  return run(conversationId, (service, id, analyst) => service.release(id, analyst));
}

export async function closeConversation(conversationId: string): Promise<ConsoleActionResult> {
  return run(conversationId, (service, id, analyst) => service.close(id, analyst));
}

/** Answers the employee in a conversation this analyst took. */
export async function replyToConversation(
  conversationId: string,
  text: string,
): Promise<ConsoleActionResult> {
  const reply = replySchema.safeParse(text);
  if (!reply.success) {
    return {
      ok: false,
      error: {
        code: "invalid_request",
        message: `Escreva uma mensagem de até ${MAX_REPLY_LENGTH} caracteres.`,
      },
    };
  }
  return run(conversationId, (service, id, analyst) => service.reply(id, analyst, reply.data));
}

/**
 * Moves a ticket of the employee in a conversation this analyst took. The
 * ticket is looked up under that employee, so no other ticket can be reached.
 */
export async function changeTicketStatus(
  conversationId: string,
  ticketId: string,
  status: TicketStatus,
): Promise<ConsoleActionResult> {
  const change = ticketChangeSchema.safeParse({ ticketId, status });
  if (!change.success) {
    return { ok: false, error: { code: "invalid_request", message: "Chamado ou status inválido." } };
  }
  return run(conversationId, async (service, id, analyst) => {
    const { employeeId } = await service.getTaken(id, analyst);
    const { ticketId, status } = change.data;
    const note = `${analyst.name} alterou ${ticketId} para ${TICKET_STATUS_LABEL[status]}`;
    await withRetry(() => getTicketService().changeStatus(employeeId, ticketId, { status, note }));
    await service.note(id, note);
  });
}

async function run(
  conversationId: unknown,
  action: (service: ConsoleService, id: string, analyst: Analyst) => Promise<unknown>,
): Promise<ConsoleActionResult> {
  const session = await getAnalystSession();
  if (!session.ok) return { ok: false, error: session.error };
  const id = conversationIdSchema.safeParse(conversationId);
  if (!id.success) {
    return { ok: false, error: { code: "invalid_request", message: "Conversa inválida." } };
  }

  try {
    await action(getConsoleService(), id.data, session.analyst);
    return { ok: true };
  } catch (error) {
    if (error instanceof ConversationNotFoundError) {
      return { ok: false, error: { code: "not_found", message: "Conversa não encontrada." } };
    }
    if (error instanceof ConversationStateError) {
      return {
        ok: false,
        error: {
          code: "conflict",
          message:
            "Esta conversa mudou enquanto você olhava: outra pessoa pode ter assumido ou encerrado. A lista foi atualizada.",
        },
      };
    }
    if (error instanceof NotFoundError) {
      return { ok: false, error: { code: "not_found", message: "Chamado não encontrado." } };
    }
    if (error instanceof InvalidStateError) {
      return {
        ok: false,
        error: {
          code: "conflict",
          message: "Este chamado não pode ir para esse status. A lista foi atualizada.",
        },
      };
    }
    if (error instanceof TicketServiceUnavailableError) {
      return {
        ok: false,
        error: {
          code: "unavailable",
          message: "O sistema de chamados está fora do ar. Tente de novo em instantes.",
        },
      };
    }
    throw error;
  }
}
