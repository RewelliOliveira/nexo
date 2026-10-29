import { getDatabase } from "@/db/client";
import {
  createConversationService,
  type ConversationService,
} from "./conversation-service";
import {
  createDecisionLogService,
  type DecisionLogService,
} from "./decision-log-service";

export {
  ConversationNotFoundError,
  createConversationService,
  type ConversationService,
  type ConversationServiceOptions,
  type MessageRole,
} from "./conversation-service";
export {
  createDecisionLogService,
  type DecisionLogService,
  type NewDecision,
} from "./decision-log-service";

let defaultConversationService: ConversationService | undefined;
let defaultDecisionLogService: DecisionLogService | undefined;

export function getConversationService(): ConversationService {
  defaultConversationService ??= createConversationService({ db: getDatabase() });
  return defaultConversationService;
}

export function getDecisionLogService(): DecisionLogService {
  defaultDecisionLogService ??= createDecisionLogService({ db: getDatabase() });
  return defaultDecisionLogService;
}
