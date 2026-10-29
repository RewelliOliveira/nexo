import { Agent, type AgentConfig } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { buildInstructions } from "./instructions";
import { getDefaultAgentServices, type AgentServices } from "./services";
import { createNexoTools } from "./tools";

export const NEXO_ASSIST_AGENT_ID = "nexo-assist";

const DEFAULT_MODEL = "google/gemini-2.5-flash";

// History sent to the model on each turn. Older messages stay in storage;
// tickets and decisions live in the services, so they are never lost.
const LAST_MESSAGES = 20;

export type NexoAssistOptions = {
  services?: AgentServices;
  /** Overrides AGENT_MODEL; tests pass a scripted model here */
  model?: AgentConfig["model"];
};

/**
 * Nexo Assist. Memory uses the Mastra storage (libSQL): one thread per
 * conversation, with the employee id as the resource.
 */
export function createNexoAssistAgent({
  services = getDefaultAgentServices(),
  model = process.env.AGENT_MODEL || DEFAULT_MODEL,
}: NexoAssistOptions = {}) {
  return new Agent({
    id: NEXO_ASSIST_AGENT_ID,
    name: "Nexo Assist",
    description: "Agent de atendimento do service desk de TI da Nexo",
    instructions: () => buildInstructions(new Date()),
    model,
    tools: createNexoTools(services),
    memory: new Memory({
      options: { lastMessages: LAST_MESSAGES, generateTitle: false },
    }),
  });
}

export const nexoAssist = createNexoAssistAgent();
