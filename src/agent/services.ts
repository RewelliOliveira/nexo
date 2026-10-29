import {
  getConversationService,
  getDecisionLogService,
  type ConversationService,
  type DecisionLogService,
} from "@/services/conversations";
import { getKbService, type KbService } from "@/services/kb";
import { getTicketService, type TicketService } from "@/services/tickets";
import type { RetryOptions } from "./retry";

/** Everything the agent may touch. The agent never talks to the database. */
export type AgentServices = {
  tickets: TicketService;
  kb: KbService;
  conversations: ConversationService;
  decisions: DecisionLogService;
  retry?: RetryOptions;
};

export function getDefaultAgentServices(): AgentServices {
  return {
    tickets: getTicketService(),
    kb: getKbService(),
    conversations: getConversationService(),
    decisions: getDecisionLogService(),
  };
}
