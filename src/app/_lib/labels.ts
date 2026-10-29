import type {
  ConversationStatus,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketType,
} from "@/db/schema";

// Domain values are English identifiers; these are the Portuguese UI labels

export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  INC: "Incidente",
  REQ: "Requisição",
};

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  access: "Acesso",
  network_vpn: "Rede e VPN",
  hardware: "Hardware",
  software: "Software",
  email: "E-mail",
  other: "Outros",
};

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  awaiting_analyst: "Aguardando analista",
  approved: "Aprovado",
  resolved: "Resolvido",
  closed: "Encerrado",
};

export const CONVERSATION_STATUS_LABEL: Record<ConversationStatus, string> = {
  with_agent: "Agent atendendo",
  awaiting_analyst: "Transferida",
  with_analyst: "Com analista",
  closed: "Encerrada",
};
