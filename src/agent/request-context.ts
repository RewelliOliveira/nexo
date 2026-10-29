import { z } from "zod";

/**
 * Values the server puts in the Mastra request context. They come from the
 * authenticated session, never from the model.
 */
export type NexoRequestContext = {
  employeeId: string;
  /** Defaults to the memory thread id, which is the conversation id */
  conversationId?: string;
};

export const nexoRequestContextSchema = z.object({
  employeeId: z.string().min(1),
  conversationId: z.string().min(1).optional(),
});
