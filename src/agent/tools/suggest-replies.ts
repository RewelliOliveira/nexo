import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const SUGGEST_REPLIES_TOOL_ID = "suggestReplies";

export const suggestRepliesInputSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3)
    .max(300)
    .describe("A pergunta que os botões respondem, ex.: 'Quem está sendo afetado?'"),
  options: z
    .array(z.string().trim().min(1).max(40))
    .min(2)
    .max(4)
    .describe("Respostas curtas que o funcionário pode tocar, ex.: ['Só eu', 'Minha equipe']"),
});

/**
 * Quick reply buttons under the agent's message. Only presentation: it changes
 * nothing, so unlike the other tools it records no decision. The question is
 * required because models sometimes call this without writing any text, and
 * the chat must never show buttons with nothing above them.
 */
export const suggestReplies = createTool({
  id: SUGGEST_REPLIES_TOOL_ID,
  description:
    "Mostra botões de resposta rápida abaixo da sua mensagem. Use quando sua pergunta tiver respostas curtas e previsíveis (ex.: quem é afetado, se quer falar com um analista). Chame por último, depois de escrever a pergunta: a resposta termina aí.",
  inputSchema: suggestRepliesInputSchema,
  outputSchema: z.object({ shown: z.literal(true) }),
  execute: async () => ({ shown: true as const }),
});

// Each step is a paid model call: a model that keeps calling tools stops here
export const MAX_TURN_STEPS = 8;

/**
 * Ends the turn once quick replies are shown, since the employee answers
 * next, or when it reaches the step limit.
 */
export function turnFinished({
  steps,
}: {
  steps: ReadonlyArray<{ toolCalls: ReadonlyArray<{ toolName: string }> }>;
}): boolean {
  if (steps.length >= MAX_TURN_STEPS) return true;
  return (
    steps.at(-1)?.toolCalls.some((call) => call.toolName === SUGGEST_REPLIES_TOOL_ID) ?? false
  );
}
