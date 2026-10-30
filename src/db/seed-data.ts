import { sql } from "drizzle-orm";
import type { Database } from "./client";
import {
  employees,
  kbArticles,
  ticketUpdates,
  tickets,
  type KbArticle,
  type Ticket,
  type TicketUpdate,
} from "./schema";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const SEED_EMPLOYEES = [
  {
    id: "emp-ana",
    email: "ana.souza@nexo.com.br",
    name: "Ana Souza",
    department: "Financeiro",
    role: "employee",
    passwordAgeDays: 42,
  },
  {
    id: "emp-bruno",
    email: "bruno.lima@nexo.com.br",
    name: "Bruno Lima",
    department: "Comercial",
    role: "employee",
    passwordAgeDays: 15,
  },
  {
    id: "emp-carla",
    email: "carla.mendes@nexo.com.br",
    name: "Carla Mendes",
    department: "Marketing",
    role: "employee",
    passwordAgeDays: 78,
  },
  {
    id: "emp-diego",
    email: "diego.rocha@nexo.com.br",
    name: "Diego Rocha",
    department: "Jurídico",
    role: "employee",
    passwordAgeDays: 5,
  },
  {
    id: "emp-marina",
    email: "marina.alves@nexo.com.br",
    name: "Marina Alves",
    department: "Service Desk",
    role: "analyst",
    passwordAgeDays: 30,
  },
] as const;

export const SEED_KB_ARTICLES: Omit<KbArticle, "createdAt">[] = [
  {
    id: "KB-001",
    title: "VPN com erro 809",
    category: "network_vpn",
    content:
      "Reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10; no Windows 11, abra um chamado.",
    tags: ["vpn", "809", "conexão", "home office", "windows 10"],
  },
  {
    id: "KB-002",
    title: "Horário do service desk",
    category: "other",
    content:
      "O service desk atende de segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.",
    tags: ["horário", "atendimento", "plantão", "contato"],
  },
  {
    id: "KB-003",
    title: "Como redefinir a senha de rede",
    category: "access",
    content:
      "Acesse senha.nexo.com.br, informe seu e-mail corporativo e confirme o código enviado ao celular cadastrado. A nova senha precisa de 12 caracteres, com letras, números e símbolo, e vale para e-mail, VPN e Wi-Fi.",
    tags: ["senha", "esqueci", "rede", "login", "expirada"],
  },
  {
    id: "KB-004",
    title: "Senha do SAP bloqueada",
    category: "access",
    content:
      "Após 5 tentativas erradas o SAP bloqueia o usuário por 30 minutos. Se precisar antes disso, use a opção 'Desbloquear usuário' no portal de autoatendimento. Se o bloqueio continuar, abra um chamado.",
    tags: ["sap", "senha", "bloqueio", "erp"],
  },
  {
    id: "KB-005",
    title: "Configurar o e-mail corporativo no celular",
    category: "email",
    content:
      "Instale o Outlook pela loja do celular, entre com o e-mail corporativo e aprove o acesso no aplicativo autenticador. Aplicativos de e-mail nativos não são suportados.",
    tags: ["e-mail", "outlook", "celular", "sincronizar", "mobile"],
  },
  {
    id: "KB-006",
    title: "Instalar programas pelo portal de softwares",
    category: "software",
    content:
      "Abra o Portal de Softwares no menu Iniciar, busque o programa e clique em Instalar. Programas que não estão no portal precisam de um chamado de requisição com a justificativa de uso.",
    tags: ["instalar", "programa", "software", "portal", "licença"],
  },
  {
    id: "KB-007",
    title: "Adicionar a impressora do andar",
    category: "hardware",
    content:
      "No Windows, vá em Configurações > Impressoras e clique em Adicionar. Escolha a impressora com o número do seu andar (ex.: IMP-ANDAR-03). Se ela não aparecer, confirme que está conectado à rede Nexo-Corp.",
    tags: ["impressora", "imprimir", "andar", "scanner"],
  },
  {
    id: "KB-008",
    title: "Computador lento após atualização do Windows",
    category: "hardware",
    content:
      "Depois de uma atualização grande, o Windows pode ficar lento por até 24 horas enquanto conclui a indexação. Reinicie o computador e mantenha-o ligado na tomada. Se a lentidão continuar após 1 dia, abra um chamado.",
    tags: ["lento", "lentidão", "windows", "atualização", "notebook"],
  },
];

type SeedTicket = Omit<Ticket, "createdAt"> & {
  createdAt: Date;
  updates: Omit<TicketUpdate, "id" | "ticketId">[];
};

/**
 * Sample tickets relative to `now`, covering: open on time, overdue,
 * resolved within 7 days (can be reopened), resolved long ago (cannot) and
 * tickets owned by other employees (privacy checks).
 */
export function buildSeedTickets(now: Date): SeedTicket[] {
  const at = (offsetMs: number) => new Date(now.getTime() + offsetMs);

  return [
    {
      // Overdue: medium priority waiting for an analyst for 6 days
      id: "INC-20311",
      employeeId: "emp-ana",
      type: "INC",
      category: "hardware",
      priority: "medium",
      status: "awaiting_analyst",
      title: "Notebook lento após atualização do Windows",
      description:
        "Desde a última atualização do Windows o notebook demora mais de 5 minutos para ligar e trava ao abrir planilhas grandes. Já reiniciei várias vezes.",
      affected: "Apenas eu",
      createdAt: at(-8 * DAY),
      updatedAt: at(-6 * DAY),
      dueAt: at(-3 * DAY),
      resolvedAt: null,
      updates: [
        {
          authorType: "employee",
          kind: "created",
          content: "Chamado aberto.",
          createdAt: at(-8 * DAY),
        },
        {
          authorType: "analyst",
          kind: "status_change",
          content:
            "Encaminhado para o time de suporte N2 para análise do equipamento.",
          createdAt: at(-6 * DAY),
        },
      ],
    },
    {
      // Open and on time
      id: "REQ-10442",
      employeeId: "emp-ana",
      type: "REQ",
      category: "hardware",
      priority: "low",
      status: "approved",
      title: "Segundo monitor para home office",
      description:
        "Solicito um segundo monitor para trabalhar de casa, para acompanhar relatórios e planilhas ao mesmo tempo.",
      affected: "Apenas eu",
      createdAt: at(-7 * DAY),
      updatedAt: at(-2 * DAY),
      dueAt: at(3 * DAY),
      resolvedAt: null,
      updates: [
        {
          authorType: "employee",
          kind: "created",
          content: "Chamado aberto.",
          createdAt: at(-7 * DAY),
        },
        {
          authorType: "analyst",
          kind: "status_change",
          content:
            "Pedido aprovado pelo gestor. Aguardando envio do equipamento.",
          createdAt: at(-2 * DAY),
        },
      ],
    },
    {
      // Resolved 4 days ago: can be reopened
      id: "INC-20150",
      employeeId: "emp-ana",
      type: "INC",
      category: "access",
      priority: "medium",
      status: "resolved",
      title: "Senha do SAP bloqueada",
      description: "Meu usuário do SAP foi bloqueado depois de errar a senha.",
      affected: "Apenas eu",
      createdAt: at(-5 * DAY),
      updatedAt: at(-4 * DAY),
      dueAt: at(-2 * DAY),
      resolvedAt: at(-4 * DAY),
      updates: [
        {
          authorType: "employee",
          kind: "created",
          content: "Chamado aberto.",
          createdAt: at(-5 * DAY),
        },
        {
          authorType: "analyst",
          kind: "status_change",
          content: "Usuário desbloqueado e senha temporária enviada por SMS.",
          createdAt: at(-4 * DAY),
        },
      ],
    },
    {
      // Resolved 20 days ago: outside the reopen window
      id: "INC-19870",
      employeeId: "emp-ana",
      type: "INC",
      category: "network_vpn",
      priority: "high",
      status: "resolved",
      title: "VPN não conecta em casa",
      description: "A VPN retorna erro de autenticação ao conectar de casa.",
      affected: "Apenas eu",
      createdAt: at(-21 * DAY),
      updatedAt: at(-20 * DAY),
      dueAt: at(-21 * DAY + 4 * HOUR),
      resolvedAt: at(-20 * DAY),
      updates: [
        {
          authorType: "employee",
          kind: "created",
          content: "Chamado aberto.",
          createdAt: at(-21 * DAY),
        },
        {
          authorType: "analyst",
          kind: "status_change",
          content: "Certificado da VPN renovado. Conexão normalizada.",
          createdAt: at(-20 * DAY),
        },
      ],
    },
    {
      // Another employee: must never be visible to Ana
      id: "INC-20320",
      employeeId: "emp-bruno",
      type: "INC",
      category: "network_vpn",
      priority: "high",
      status: "in_progress",
      title: "VPN com erro 809 no Windows 11",
      description:
        "A VPN mostra o erro 809 ao conectar. Meu computador é Windows 11 e tenho reunião com cliente hoje à tarde.",
      affected: "Apenas eu",
      createdAt: at(-2 * HOUR),
      updatedAt: at(-1 * HOUR),
      dueAt: at(2 * HOUR),
      resolvedAt: null,
      updates: [
        {
          authorType: "employee",
          kind: "created",
          content: "Chamado aberto.",
          createdAt: at(-2 * HOUR),
        },
      ],
    },
    {
      // Same problem as Ana's INC-20311, but from another employee
      id: "INC-20318",
      employeeId: "emp-bruno",
      type: "INC",
      category: "hardware",
      priority: "medium",
      status: "open",
      title: "Notebook lento após atualização do Windows",
      description:
        "O notebook ficou muito lento depois da atualização de ontem.",
      affected: "Apenas eu",
      createdAt: at(-1 * DAY),
      updatedAt: at(-1 * DAY),
      dueAt: at(2 * DAY),
      resolvedAt: null,
      updates: [
        {
          authorType: "employee",
          kind: "created",
          content: "Chamado aberto.",
          createdAt: at(-1 * DAY),
        },
      ],
    },
    {
      id: "REQ-10450",
      employeeId: "emp-carla",
      type: "REQ",
      category: "access",
      priority: "low",
      status: "open",
      title: "Acesso ao Power BI de campanhas",
      description:
        "Preciso de acesso de leitura ao workspace de campanhas no Power BI.",
      affected: "Apenas eu",
      createdAt: at(-1 * DAY),
      updatedAt: at(-1 * DAY),
      dueAt: at(4 * DAY),
      resolvedAt: null,
      updates: [
        {
          authorType: "employee",
          kind: "created",
          content: "Chamado aberto.",
          createdAt: at(-1 * DAY),
        },
      ],
    },
  ];
}

/** Drops every table (including Drizzle's migration journal). */
export async function resetDatabase(db: Database): Promise<void> {
  const rows = await db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  );
  await db.run(sql`PRAGMA foreign_keys = OFF`);
  for (const { name } of rows) {
    await db.run(sql.raw(`DROP TABLE IF EXISTS "${name}"`));
  }
  await db.run(sql`PRAGMA foreign_keys = ON`);
}

export async function seedDatabase(
  db: Database,
  now = new Date(),
): Promise<void> {
  const seedTickets = buildSeedTickets(now);

  await db
    .insert(employees)
    .values(
      SEED_EMPLOYEES.map(({ passwordAgeDays, ...employee }) => ({
        ...employee,
        passwordChangedAt: new Date(now.getTime() - passwordAgeDays * DAY),
        createdAt: now,
      })),
    );
  await db
    .insert(kbArticles)
    .values(
      SEED_KB_ARTICLES.map((article) => ({ ...article, createdAt: now })),
    );
  await db
    .insert(tickets)
    .values(seedTickets.map(({ updates, ...ticket }) => ticket));
  await db
    .insert(ticketUpdates)
    .values(
      seedTickets.flatMap((ticket) =>
        ticket.updates.map((update) => ({ ...update, ticketId: ticket.id })),
      ),
    );
}
