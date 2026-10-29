import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const SUGGEST_REPLIES_TOOL_ID = "suggestReplies";

export const suggestRepliesInputSchema = z.object({
  options: z
    .array(z.string().trim().min(1).max(40))
    .min(2)
    .max(4)
    .describe("Respostas curtas que o funcionário pode tocar, ex.: ['Só eu', 'Minha equipe']"),
});

/**
 * Quick reply buttons under the agent's message. Only presentation: it changes
 * nothing, so unlike the other tools it records no decision.
 */
export const suggestReplies = createTool({
  id: SUGGEST_REPLIES_TOOL_ID,
  description:
    "Mostra botões de resposta rápida abaixo da sua mensagem. Use quando sua pergunta tiver respostas curtas e previsíveis (ex.: quem é afetado, se quer falar com um analista). Chame por último, depois de escrever a pergunta: a resposta termina aí.",
  inputSchema: suggestRepliesInputSchema,
  outputSchema: z.object({ shown: z.literal(true) }),
  execute: async () => ({ shown: true as const }),
});

/** Ends the turn once quick replies are shown: the employee answers next. */
export function repliesSuggested({
  steps,
}: {
  steps: ReadonlyArray<{ toolCalls: ReadonlyArray<{ toolName: string }> }>;
}): boolean {
  return (
    steps.at(-1)?.toolCalls.some((call) => call.toolName === SUGGEST_REPLIES_TOOL_ID) ?? false
  );
}
