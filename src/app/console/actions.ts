"use server";

import { z } from "zod";
import {
  ConversationNotFoundError,
  ConversationStateError,
  getConsoleService,
  type Analyst,
  type ConsoleService,
} from "@/services/conversations";
import { getAnalystSession } from "./_lib/analyst-session";
import type { ConsoleError } from "./_lib/console-state";

export type ConsoleActionResult = { ok: true } | { ok: false; error: ConsoleError };

const conversationIdSchema = z.string().trim().min(1).max(100);

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
    throw error;
  }
}
