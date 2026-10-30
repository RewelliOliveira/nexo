import { getDatabase } from "@/db/client";
import { createConsoleService, type ConsoleService } from "./console-service";
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
  ConversationStateError,
  createConversationService,
  type AuthoredMessage,
  type ConversationService,
  type ConversationServiceOptions,
  type MessageRole,
} from "./conversation-service";
export {
  createDecisionLogService,
  type DecisionLogService,
  type NewDecision,
} from "./decision-log-service";
export {
  CONSOLE_LIST_LIMIT,
  createConsoleService,
  type Analyst,
  type ConsoleConversation,
  type ConsoleService,
} from "./console-service";

let defaultConversationService: ConversationService | undefined;
let defaultDecisionLogService: DecisionLogService | undefined;
let defaultConsoleService: ConsoleService | undefined;

/** Every employee's conversations: only for analysts, the caller checks the role. */
export function getConsoleService(): ConsoleService {
  defaultConsoleService ??= createConsoleService({ db: getDatabase() });
  return defaultConsoleService;
}

export function getConversationService(): ConversationService {
  defaultConversationService ??= createConversationService({ db: getDatabase() });
  return defaultConversationService;
}

export function getDecisionLogService(): DecisionLogService {
  defaultDecisionLogService ??= createDecisionLogService({ db: getDatabase() });
  return defaultDecisionLogService;
}
