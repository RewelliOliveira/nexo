import type { ToolCall } from "./tool-parts";

type ActionText = {
  /** "consultando seus chamados", while the call runs */
  running: string;
  /** "consultar seus chamados", the action in the decision details */
  infinitive: string;
};

const ACTION_TEXT: Record<string, ActionText> = {
  searchKnowledgeBase: {
    running: "buscando na central de ajuda",
    infinitive: "buscar na central de ajuda",
  },
  listMyTickets: { running: "consultando seus chamados", infinitive: "consultar seus chamados" },
  getTicket: { running: "consultando o chamado", infinitive: "consultar o chamado" },
  findSimilarTickets: {
    running: "procurando chamados parecidos",
    infinitive: "procurar chamados parecidos",
  },
  draftTicket: { running: "montando o rascunho", infinitive: "montar o rascunho do chamado" },
  createTicket: { running: "abrindo o chamado", infinitive: "abrir o chamado" },
  updateTicket: { running: "atualizando o chamado", infinitive: "atualizar o chamado" },
  reopenTicket: { running: "reabrindo o chamado", infinitive: "reabrir o chamado" },
  handoffToAnalyst: {
    running: "transferindo para um analista",
    infinitive: "transferir para um analista",
  },
};

const FALLBACK_TEXT: ActionText = { running: "trabalhando", infinitive: "executar uma ação" };

/** Errors the rules of the service desk raise on purpose, in plain words. */
const FAILURE_LABEL: Record<string, string> = {
  service_unavailable: "sistema de chamados fora do ar",
  confirmation_required: "bloqueado: faltava sua confirmação",
  draft_not_confirmed: "bloqueado: faltava sua confirmação",
  low_confidence: "bloqueado: confiança baixa para alterar dados",
  duplicate: "evitou um chamado duplicado",
  not_found: "não encontrou o chamado",
};

/** "Consultar seus chamados", for the action of a recorded decision. */
export function actionName(action: string): string {
  const text = ACTION_TEXT[action]?.infinitive ?? action;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * What the agent did in a tool call, as short past-tense labels shown above
 * its reply ("consultou seus chamados"). One call can show several steps.
 */
export function actionLabels(call: ToolCall): string[] {
  const text = ACTION_TEXT[call.toolName] ?? FALLBACK_TEXT;
  if (call.state === "running") return [`${text.running}…`];
  if (call.state === "failed") {
    return [FAILURE_LABEL[call.errorCode] ?? `não conseguiu ${text.infinitive}`];
  }

  const ticket = call.ticketId ?? "o chamado";
  const result = call.result;
  switch (call.toolName) {
    case "searchKnowledgeBase":
      return ["buscou na central de ajuda"];
    case "listMyTickets":
      return ["consultou seus chamados"];
    case "getTicket":
      return [`consultou o ${ticket}`, "calculou o prazo"];
    case "findSimilarTickets":
      return ["procurou chamados parecidos"];
    case "draftTicket": {
      const labels = ["classificou a prioridade", "calculou o prazo", "montou o rascunho"];
      const similar =
        result?.tool === "draftTicket" &&
        result.data.similar.active.length + result.data.similar.reopenable.length > 0;
      return similar ? [...labels, "encontrou chamado parecido"] : labels;
    }
    case "createTicket": {
      if (result?.tool !== "createTicket") return ["abriu o chamado"];
      const opened = `abriu o ${result.data.ticket.id}`;
      return result.data.handedOffToAnalyst ? [opened, "transferiu para um analista"] : [opened];
    }
    case "updateTicket":
      return [`atualizou o ${result?.tool === "updateTicket" ? result.data.ticket.id : ticket}`];
    case "reopenTicket":
      return [`reabriu o ${result?.tool === "reopenTicket" ? result.data.ticket.id : ticket}`];
    case "handoffToAnalyst":
      return ["transferiu para um analista"];
    default:
      return [text.infinitive];
  }
}
