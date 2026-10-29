import type { AgentServices } from "../services";
import { createReadTools } from "./read-tools";
import { createWriteTools } from "./write-tools";

export { MIN_CONFIDENCE_TO_CHANGE } from "./write-tools";

export function createNexoTools(services: AgentServices) {
  return {
    ...createReadTools(services),
    ...createWriteTools(services),
  };
}

export type NexoTools = ReturnType<typeof createNexoTools>;
