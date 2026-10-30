import { withRetry } from "@/agent/retry";
import type { DecisionLog } from "@/db/schema";
import {
  getConsoleService,
  getDecisionLogService,
  type ConsoleConversation,
} from "@/services/conversations";
import {
  getTicketService,
  nextStatuses,
  TicketServiceUnavailableError,
  type TicketSummary,
} from "@/services/tickets";
import { toDecisionView } from "../../chat/_lib/decision-view";
import type {
  ConsoleTicket,
  ConversationDetail,
  ConversationItem,
  HistoryMessage,
} from "./console-state";

// Loaders for the analyst console. Callers check the analyst role first.

export async function loadConversationList(): Promise<ConversationItem[]> {
  const conversations = await getConsoleService().list();
  return conversations.map(toItem);
}

/**
 * Everything the analyst needs to pick up a case: the history with the
 * agent's decisions, the handoff summary and the employee's tickets.
 * Throws ConversationNotFoundError for an unknown id.
 */
export async function loadConversationDetail(conversationId: string): Promise<ConversationDetail> {
  const consoleService = getConsoleService();
  const conversation = await consoleService.get(conversationId);
  const [messages, decisions, tickets] = await Promise.all([
    consoleService.listMessages(conversationId),
    getDecisionLogService().listByConversation(conversationId),
    loadTickets(conversation.employeeId),
  ]);

  const byMessage = new Map<string, DecisionLog[]>();
  const pending: DecisionLog[] = [];
  for (const decision of decisions) {
    const { messageId } = decision;
    if (!messageId) pending.push(decision);
    else byMessage.set(messageId, [...(byMessage.get(messageId) ?? []), decision]);
  }

  return {
    conversation: toItem(conversation),
    messages: messages.map(
      (message): HistoryMessage => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        authorName: message.authorName,
        decisions: (byMessage.get(message.id) ?? []).map(toDecisionView),
      }),
    ),
    pendingDecisions: pending.map(toDecisionView),
    tickets,
  };
}

/** The employee's tickets, or null when the legacy system stays down. */
async function loadTickets(employeeId: string): Promise<ConsoleTicket[] | null> {
  try {
    const tickets = await withRetry(() =>
      getTicketService().list(employeeId, { scope: "all" }),
    );
    return tickets.map(toConsoleTicket);
  } catch (error) {
    if (error instanceof TicketServiceUnavailableError) return null;
    throw error;
  }
}

function toItem(conversation: ConsoleConversation): ConversationItem {
  return {
    id: conversation.id,
    status: conversation.status,
    employee: conversation.employee,
    analystId: conversation.analystId,
    analystName: conversation.analystName,
    lastMessage: conversation.lastMessage && {
      ...conversation.lastMessage,
      createdAt: conversation.lastMessage.createdAt.toISOString(),
    },
    unanswered: conversation.unanswered,
    updatedAt: conversation.updatedAt.toISOString(),
    handoffReason: conversation.handoffReason,
    handoffSummary: conversation.handoffSummary,
    handoffTicketId: conversation.handoffTicketId,
    handoffConfidence: conversation.handoffConfidence,
    handedOffAt: conversation.handedOffAt?.toISOString() ?? null,
  };
}

function toConsoleTicket(ticket: TicketSummary): ConsoleTicket {
  return {
    id: ticket.id,
    type: ticket.type,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    nextStatuses: nextStatuses(ticket, new Date()),
    title: ticket.title,
    isOverdue: ticket.isOverdue,
    updatedAt: ticket.updatedAt.toISOString(),
    dueAt: ticket.dueAt.toISOString(),
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
  };
}
