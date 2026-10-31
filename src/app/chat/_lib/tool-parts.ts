import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { z } from "zod";
import {
  parseDateTime,
  ticketDetailViewSchema,
  ticketViewSchema,
  type TicketView,
} from "@/agent/tools/ticket-view";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_TYPES,
} from "@/lib/domain";
import type { TicketCardTicket } from "../../_components/TicketCard";

// Tool calls arrive in the UI message as raw tool input and output. Parsing
// them here keeps the components free of unknown shapes.

const draftSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(TICKET_TYPES),
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES),
  affected: z.string(),
});

const RESULT_SCHEMAS = {
  searchKnowledgeBase: z.object({
    articles: z.array(z.object({ id: z.string(), title: z.string() })),
  }),
  listMyTickets: z.object({ tickets: z.array(ticketViewSchema) }),
  getTicket: z.object({ ticket: ticketDetailViewSchema }),
  findSimilarTickets: z.object({
    active: z.array(ticketViewSchema),
    reopenable: z.array(ticketViewSchema),
  }),
  draftTicket: z.object({
    draftId: z.string(),
    draft: draftSchema,
    dueAtIfCreatedNow: z.string(),
    similar: z.object({
      active: z.array(ticketViewSchema),
      reopenable: z.array(ticketViewSchema),
    }),
  }),
  createTicket: z.object({ ticket: ticketViewSchema, handedOffToAnalyst: z.boolean() }),
  updateTicket: z.object({ ticket: ticketViewSchema }),
  reopenTicket: z.object({ ticket: ticketViewSchema }),
  handoffToAnalyst: z.object({ ticket: ticketViewSchema.nullable() }),
} as const;

type ResultSchemas = typeof RESULT_SCHEMAS;
export type KnownTool = keyof ResultSchemas;

export type ToolResult = {
  [K in KnownTool]: { tool: K; data: z.infer<ResultSchemas[K]> };
}[KnownTool];

export type ToolDraft = z.infer<typeof draftSchema>;

const envelopeSchema = z.union([
  z.object({ ok: z.literal(true), data: z.unknown(), decisionId: z.string() }),
  z.object({
    ok: z.literal(false),
    error: z.object({ code: z.string(), message: z.string() }),
    decisionId: z.string().nullable(),
  }),
  // Mastra's own answer when the model sends input the schema refuses
  z.object({ error: z.literal(true), message: z.string() }),
]);

const ticketIdInputSchema = z.object({ ticketId: z.string() });
const draftIdInputSchema = z.object({ draftId: z.string() });
// Replies stored before the question became required have none
const repliesInputSchema = z.object({
  question: z.string().optional(),
  options: z.array(z.string()).min(1),
});

export type ToolCall = {
  toolCallId: string;
  toolName: string;
  /** Number of the ticket the call is about, when the model sent one */
  ticketId: string | null;
  /** Draft the call creates the ticket from (createTicket) */
  draftId: string | null;
} & (
  | { state: "running" }
  | { state: "done"; decisionId: string; result: ToolResult | null }
  | { state: "failed"; decisionId: string | null; errorCode: string }
);

export const QUICK_REPLIES_TOOL = "suggestReplies";

/** Decision log of the call; null while running or when none was recorded. */
export function decisionIdOf(call: ToolCall): string | null {
  return call.state === "running" ? null : call.decisionId;
}

type MessagePart = UIMessage["parts"][number];

/** Tool calls of an agent message, in order. Quick replies are left out. */
export function toolCallsOf(message: UIMessage): ToolCall[] {
  return message.parts.flatMap((part) => {
    if (!isToolUIPart(part)) return [];
    const toolName = getToolName(part);
    if (toolName === QUICK_REPLIES_TOOL) return [];
    return [parseToolPart(part, toolName)];
  });
}

function quickReplyInput(message: UIMessage) {
  for (const part of message.parts) {
    if (!isToolUIPart(part) || getToolName(part) !== QUICK_REPLIES_TOOL) continue;
    const input = repliesInputSchema.safeParse(part.input);
    if (input.success) return input.data;
  }
  return null;
}

/** Options the agent offered as buttons in this message, if any. */
export function quickRepliesOf(message: UIMessage): string[] {
  return quickReplyInput(message)?.options ?? [];
}

/** The question those buttons answer, for a message with no text of its own. */
export function quickReplyQuestionOf(message: UIMessage): string | null {
  return quickReplyInput(message)?.question ?? null;
}

/** Offered under an overdue ticket (Annex A), whatever the model wrote. */
export const OVERDUE_REPLIES = ["Falar com um analista", "Adicionar informação", "Não, obrigado"];

/**
 * Overdue tickets the reply ended up showing. Only the last call counts: a
 * listing followed by other tools was a check, not an answer about tickets.
 */
export function overdueTicketsOf(calls: ToolCall[]): string[] {
  const last = calls.at(-1);
  if (last?.state !== "done" || !last.result) return [];
  const { result } = last;
  const tickets =
    result.tool === "listMyTickets"
      ? result.data.tickets
      : result.tool === "getTicket"
        ? [result.data.ticket]
        : [];
  return tickets.filter((ticket) => ticket.isOverdue).map((ticket) => ticket.id);
}

export function textOf(message: UIMessage): string {
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n\n")
    .trim();
}

function parseToolPart(
  part: Extract<MessagePart, { toolCallId: string }>,
  toolName: string,
): ToolCall {
  const ticketInput = ticketIdInputSchema.safeParse(part.input);
  const draftInput = draftIdInputSchema.safeParse(part.input);
  const base = {
    toolCallId: part.toolCallId,
    toolName,
    ticketId: ticketInput.success ? ticketInput.data.ticketId.toUpperCase() : null,
    draftId: draftInput.success ? draftInput.data.draftId : null,
  };

  if (part.state === "output-error") {
    return { ...base, state: "failed", decisionId: null, errorCode: "tool_error" };
  }
  if (part.state !== "output-available") return { ...base, state: "running" };

  const envelope = envelopeSchema.safeParse(part.output);
  if (!envelope.success) {
    return { ...base, state: "failed", decisionId: null, errorCode: "unexpected_output" };
  }
  const output = envelope.data;
  if ("error" in output && output.error === true) {
    return { ...base, state: "failed", decisionId: null, errorCode: "invalid_input" };
  }
  if (!("ok" in output)) {
    return { ...base, state: "failed", decisionId: null, errorCode: "unexpected_output" };
  }
  if (!output.ok) {
    return {
      ...base,
      state: "failed",
      decisionId: output.decisionId,
      errorCode: output.error.code,
    };
  }
  return {
    ...base,
    state: "done",
    decisionId: output.decisionId,
    result: parseResult(toolName, output.data),
  };
}

function parseResult(toolName: string, data: unknown): ToolResult | null {
  if (!isKnownTool(toolName)) return null;
  const parsed = RESULT_SCHEMAS[toolName].safeParse(data);
  // The cast pairs the tool name with the schema it was just parsed with
  return parsed.success ? ({ tool: toolName, data: parsed.data } as ToolResult) : null;
}

function isKnownTool(name: string): name is KnownTool {
  return Object.hasOwn(RESULT_SCHEMAS, name);
}

/** A ticket from a tool result, as the ticket card takes it. */
export function toCardTicket(
  view: TicketView & { description?: string },
): TicketCardTicket | null {
  const createdAt = parseDateTime(view.createdAt);
  const updatedAt = parseDateTime(view.updatedAt);
  if (!createdAt || !updatedAt) return null;
  return {
    id: view.id,
    title: view.title,
    description: view.description,
    status: view.status,
    category: view.category,
    priority: view.priority,
    isOverdue: view.isOverdue,
    createdAt,
    updatedAt,
  };
}
