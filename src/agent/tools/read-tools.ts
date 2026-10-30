import { z } from "zod";
import { TICKET_CATEGORIES } from "@/db/schema";
import type { AgentServices } from "../services";
import { decisionFields, defineNexoTool } from "./define-tool";
import {
  ticketDetailViewSchema,
  ticketViewSchema,
  toTicketDetailView,
  toTicketView,
} from "./ticket-view";

export const ticketIdField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^(INC|REQ)-\d+$/, "use o formato INC-12345 ou REQ-12345")
  .describe("Número do chamado, ex.: INC-20311");

export function createReadTools(services: AgentServices) {
  const searchKnowledgeBase = defineNexoTool(services, {
    id: "searchKnowledgeBase",
    description:
      "Busca artigos na central de ajuda. Use antes de abrir chamado para dúvidas e problemas que talvez o funcionário resolva sozinho.",
    inputSchema: z.object({
      ...decisionFields,
      query: z.string().trim().min(2).max(300).describe("Palavras-chave do problema"),
      category: z.enum(TICKET_CATEGORIES).optional(),
    }),
    outputSchema: z.object({
      articles: z.array(
        z.object({ id: z.string(), title: z.string(), content: z.string() }),
      ),
    }),
    async run({ query, category }) {
      const results = await services.kb.search({ query, category });
      return {
        articles: results.map(({ id, title, content }) => ({ id, title, content })),
      };
    },
  });

  const listMyTickets = defineNexoTool(services, {
    id: "listMyTickets",
    description:
      "Lista os chamados do funcionário logado, com status e se estão vencidos. Use quando ele perguntar pelos chamados dele ou não lembrar o número.",
    inputSchema: z.object({
      ...decisionFields,
      scope: z
        .enum(["active", "all"])
        .default("active")
        .describe("active: só os em andamento; all: inclui resolvidos e fechados"),
    }),
    outputSchema: z.object({ tickets: z.array(ticketViewSchema) }),
    async run({ scope }, { employeeId, callTickets }) {
      const tickets = await callTickets((service) => service.list(employeeId, { scope }));
      return { tickets: tickets.map(toTicketView) };
    },
  });

  const getTicket = defineNexoTool(services, {
    id: "getTicket",
    description:
      "Mostra um chamado do funcionário logado com descrição e histórico. Só retorna chamados dele.",
    inputSchema: z.object({ ...decisionFields, ticketId: ticketIdField }),
    outputSchema: z.object({ ticket: ticketDetailViewSchema }),
    async run({ ticketId }, { employeeId, callTickets }) {
      const ticket = await callTickets((service) => service.get(employeeId, ticketId));
      return { ticket: toTicketDetailView(ticket) };
    },
  });

  const findSimilarTickets = defineNexoTool(services, {
    id: "findSimilarTickets",
    description:
      "Procura chamados do funcionário sobre o mesmo problema: abertos (devem ser atualizados, não duplicados) e resolvidos há até 7 dias (podem ser reabertos).",
    inputSchema: z.object({
      ...decisionFields,
      title: z.string().trim().min(3).max(120).describe("Resumo curto do problema"),
      category: z.enum(TICKET_CATEGORIES),
    }),
    outputSchema: z.object({
      active: z.array(ticketViewSchema),
      reopenable: z.array(ticketViewSchema),
    }),
    async run({ title, category }, { employeeId, callTickets }) {
      const similar = await callTickets((service) =>
        service.findSimilar(employeeId, { title, category }),
      );
      return {
        active: similar.active.map(toTicketView),
        reopenable: similar.reopenable.map(toTicketView),
      };
    },
  });

  return { searchKnowledgeBase, listMyTickets, getTicket, findSimilarTickets };
}
