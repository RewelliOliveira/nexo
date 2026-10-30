import { z } from "zod";
import { TICKET_PRIORITIES } from "@/db/schema";
import {
  computeDueAt,
  createTicketInputSchema,
  HANDOFF_REASONS,
  type TicketDetail,
  type TicketSummary,
} from "@/services/tickets";
import type { AgentServices } from "../services";
import {
  confirmationField,
  decisionFields,
  defineNexoTool,
  type NexoToolContext,
} from "./define-tool";
import { ticketIdField } from "./read-tools";
import { formatDateTime, ticketViewSchema, toTicketView } from "./ticket-view";
import { ToolRejection } from "./tool-errors";

// Below this, changing data is refused and the agent must ask or hand off
export const MIN_CONFIDENCE_TO_CHANGE = 0.5;

const HANDOFF_SUMMARY_MAX = 4000;

const ticketFields = {
  title: createTicketInputSchema.shape.title.describe(
    "Título curto e específico, ex.: 'VPN com erro 809 no Windows 11'",
  ),
  description: createTicketInputSchema.shape.description.describe(
    "O que acontece, desde quando, o que já foi tentado e mensagens de erro",
  ),
  type: createTicketInputSchema.shape.type.describe(
    "INC quando algo parou ou não funciona; REQ para pedido de acesso, equipamento ou software",
  ),
  category: createTicketInputSchema.shape.category,
  priority: createTicketInputSchema.shape.priority.describe(
    "critical: equipe ou empresa parada; high: uma pessoa impedida ou compromisso hoje; medium: atrapalha, há alternativa; low: sem urgência",
  ),
  affected: createTicketInputSchema.shape.affected.describe(
    "Quem é afetado, ex.: 'Apenas eu' ou 'Time financeiro (8 pessoas)'",
  ),
};

/** What draftTicket stores in its decision log for createTicket to read back. */
const storedDraftSchema = z.object({
  outcome: z.literal("success"),
  output: z.object({ draft: createTicketInputSchema }),
});

export function createWriteTools(services: AgentServices) {
  const draftTicket = defineNexoTool(services, {
    id: "draftTicket",
    description:
      "Monta o rascunho de um chamado novo SEM criá-lo e procura chamados parecidos do funcionário. Mostre o rascunho (com prioridade e prazo) e peça confirmação. Se houver chamado aberto parecido, ofereça atualizá-lo; se houver resolvido há até 7 dias, ofereça reabrir.",
    inputSchema: z.object({ ...decisionFields, ...ticketFields }),
    outputSchema: z.object({
      draftId: z.string(),
      draft: createTicketInputSchema,
      dueAtIfCreatedNow: z.string(),
      similar: z.object({
        active: z.array(ticketViewSchema),
        reopenable: z.array(ticketViewSchema),
      }),
    }),
    async run(input, { employeeId, decisionId, callTickets }) {
      const draft = createTicketInputSchema.parse({
        title: input.title,
        description: input.description,
        type: input.type,
        category: input.category,
        priority: input.priority,
        affected: input.affected,
      });
      const similar = await callTickets((service) =>
        service.findSimilar(employeeId, { title: draft.title, category: draft.category }),
      );
      return {
        draftId: decisionId,
        draft,
        dueAtIfCreatedNow: formatDateTime(computeDueAt(draft.priority, new Date())),
        similar: {
          active: similar.active.map(toTicketView),
          reopenable: similar.reopenable.map(toTicketView),
        },
      };
    },
  });

  const createTicket = defineNexoTool(services, {
    id: "createTicket",
    description:
      "Cria o chamado de um rascunho já mostrado ao funcionário, depois que ele confirmou. Os dados vêm do rascunho; para mudar algo, gere um novo rascunho. Chamados críticos são transferidos automaticamente para um analista.",
    inputSchema: z.object({
      ...decisionFields,
      ...confirmationField,
      draftId: z.string().min(1).describe("draftId devolvido por draftTicket"),
    }),
    outputSchema: z.object({ ticket: ticketViewSchema, handedOffToAnalyst: z.boolean() }),
    requiresConfirmation: true,
    minConfidence: MIN_CONFIDENCE_TO_CHANGE,
    async run({ draftId }, context) {
      const draft = await loadConfirmedDraft(services, context, draftId);
      const ticket = await context.callTickets((service) =>
        service.create(context.employeeId, draft),
      );
      const handedOff =
        ticket.priority === "critical" ? await handOffCriticalTicket(context, ticket) : null;
      return { ticket: toTicketView(handedOff ?? ticket), handedOffToAnalyst: handedOff !== null };
    },
  });

  const updateTicket = defineNexoTool(services, {
    id: "updateTicket",
    description:
      "Acrescenta informações a um chamado aberto do funcionário (e opcionalmente muda a prioridade). Antes, mostre o texto que será adicionado e peça confirmação.",
    inputSchema: z.object({
      ...decisionFields,
      ...confirmationField,
      ticketId: ticketIdField,
      comment: z.string().trim().min(3).max(4000).describe("Informação nova a registrar"),
      priority: z.enum(TICKET_PRIORITIES).optional(),
    }),
    outputSchema: z.object({ ticket: ticketViewSchema }),
    requiresConfirmation: true,
    minConfidence: MIN_CONFIDENCE_TO_CHANGE,
    async run({ ticketId, comment, priority }, { employeeId, callTickets }) {
      const ticket = await callTickets((service) =>
        service.update(employeeId, ticketId, { comment, priority }),
      );
      return { ticket: toTicketView(ticket) };
    },
  });

  const reopenTicket = defineNexoTool(services, {
    id: "reopenTicket",
    description:
      "Reabre um chamado do funcionário resolvido há até 7 dias, quando o mesmo problema voltou. Antes, confirme com o funcionário.",
    inputSchema: z.object({
      ...decisionFields,
      ...confirmationField,
      ticketId: ticketIdField,
      reopenReason: z
        .string()
        .trim()
        .min(3)
        .max(4000)
        .describe("O que voltou a acontecer, nas palavras do funcionário"),
    }),
    outputSchema: z.object({ ticket: ticketViewSchema }),
    requiresConfirmation: true,
    minConfidence: MIN_CONFIDENCE_TO_CHANGE,
    async run({ ticketId, reopenReason }, { employeeId, callTickets }) {
      const ticket = await callTickets((service) =>
        service.reopen(employeeId, ticketId, { reason: reopenReason }),
      );
      return { ticket: toTicketView(ticket) };
    },
  });

  const handoffToAnalyst = defineNexoTool(services, {
    id: "handoffToAnalyst",
    description:
      "Transfere a conversa para um analista humano, com um resumo do caso. Use quando o funcionário pedir, em caso crítico, com chamado vencido ou quando você não tiver segurança. Depois disso você não responde mais nesta conversa.",
    inputSchema: z.object({
      ...decisionFields,
      ...confirmationField,
      handoffReason: z
        .enum(HANDOFF_REASONS)
        .describe(
          "employee_request: o funcionário pediu; critical: caso crítico; overdue: chamado vencido; low_confidence: você não tem segurança",
        ),
      summary: z
        .string()
        .trim()
        .min(10)
        .max(HANDOFF_SUMMARY_MAX)
        .describe(
          "Resumo para o analista não precisar perguntar tudo de novo: problema, o que já foi tentado, chamados envolvidos e o que o funcionário espera",
        ),
      ticketId: ticketIdField.optional(),
    }),
    outputSchema: z.object({ status: z.string(), ticket: ticketViewSchema.nullable() }),
    requiresConfirmation: true,
    async run({ handoffReason, summary, ticketId }, { employeeId, conversationId, callTickets }) {
      const result = await callTickets((service) =>
        service.handoff(employeeId, {
          conversationId,
          reason: handoffReason,
          summary,
          ticketId,
        }),
      );
      return {
        status: result.conversation.status,
        ticket: result.ticket ? toTicketView(result.ticket) : null,
      };
    },
  });

  return { draftTicket, createTicket, updateTicket, reopenTicket, handoffToAnalyst };
}

/**
 * The draft must come from draftTicket in this conversation and the employee
 * must have written after it was produced: a draft made in the same turn was
 * never seen, so it cannot have been confirmed.
 */
async function loadConfirmedDraft(
  services: AgentServices,
  { conversationId, lastEmployeeMessageAt }: NexoToolContext,
  draftId: string,
) {
  const log = await services.decisions.get(conversationId, draftId);
  const stored = storedDraftSchema.safeParse(log?.details);
  if (!log || log.action !== "draftTicket" || !stored.success) {
    throw new ToolRejection(
      "draft_not_found",
      "Rascunho não encontrado nesta conversa. Gere o rascunho com draftTicket e mostre ao funcionário antes de criar.",
    );
  }
  if (!lastEmployeeMessageAt || log.createdAt >= lastEmployeeMessageAt) {
    throw new ToolRejection(
      "draft_not_confirmed",
      "O funcionário ainda não viu este rascunho. Mostre o rascunho e espere a resposta dele antes de criar o chamado.",
    );
  }
  return stored.data.output.draft;
}

/**
 * Critical tickets always go to an analyst (Annex A). If the handoff fails the
 * ticket still exists; the model is told so it can offer the handoff itself.
 * Returns the ticket as it is after the handoff.
 */
async function handOffCriticalTicket(
  { employeeId, conversationId, callTickets, recordDecision }: NexoToolContext,
  ticket: TicketDetail,
): Promise<TicketSummary | null> {
  const summary = `Chamado crítico ${ticket.id}: ${ticket.title}. Afetados: ${ticket.affected}. ${ticket.description}`;
  try {
    const result = await callTickets((service) =>
      service.handoff(employeeId, {
        conversationId,
        reason: "critical",
        summary: summary.slice(0, HANDOFF_SUMMARY_MAX),
        ticketId: ticket.id,
      }),
    );
    await recordDecision({
      intent: "Resolver um problema crítico",
      action: "handoffToAnalyst",
      confidence: 1,
      reason: `Chamado ${ticket.id} tem prioridade crítica: a regra do service desk exige transferir para um analista.`,
      details: { outcome: "success", automatic: true, ticketId: ticket.id },
    });
    return result.ticket;
  } catch (error) {
    console.error("[nexo-assist] automatic handoff failed", error);
    return null;
  }
}
