import type { AgentServices } from "../services";
import { createReadTools } from "./read-tools";
import { suggestReplies } from "./suggest-replies";
import { createWriteTools } from "./write-tools";

export { MAX_TURN_STEPS, SUGGEST_REPLIES_TOOL_ID, turnFinished } from "./suggest-replies";
export { MIN_CONFIDENCE_TO_CHANGE } from "./write-tools";

export function createNexoTools(services: AgentServices) {
  return {
    ...createReadTools(services),
    ...createWriteTools(services),
    suggestReplies,
  };
}

export type NexoTools = ReturnType<typeof createNexoTools>;
