"use client";

import { CheckCheck, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ConversationItem } from "../_lib/console-state";
import {
  avatarColor,
  CONSOLE_FILTER_LABEL,
  CONSOLE_FILTERS,
  conversationTag,
  formatListTime,
  initials,
  matchesFilter,
  matchesSearch,
  messagePreview,
  needsAttention,
  sortForConsole,
  type ConsoleFilter,
  type ConversationTag,
} from "../_lib/console-view";

type ConversationListProps = {
  conversations: ConversationItem[];
  analystId: string;
  selectedId: string | null;
  now: Date;
  /** The list could not be refreshed; shows the last one received */
  stale: boolean;
  onSelect(conversationId: string): void;
  className?: string;
};

/** Every conversation, waiting ones first, with filters by who handles it. */
export function ConversationList({
  conversations,
  analystId,
  selectedId,
  now,
  stale,
  onSelect,
  className = "",
}: ConversationListProps) {
  const [filter, setFilter] = useState<ConsoleFilter>("all");
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => sortForConsole(conversations), [conversations]);
  const visible = sorted.filter(
    (conversation) =>
      matchesFilter(conversation, filter, analystId) && matchesSearch(conversation, query),
  );

  return (
    <section
      aria-label="Conversas"
      className={`w-full shrink-0 flex-col border-r border-rule bg-paper lg:w-95 ${className}`}
    >
      <header className="flex flex-col gap-3 px-4 pt-4 pb-2.5">
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-xl font-bold text-ink">Conversas</h1>
          <span className="flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1.25 text-[12.5px] font-semibold text-success-text">
            <span aria-hidden className="size-1.75 rounded-full bg-success" />
            Disponível
          </span>
        </div>

        <label className="flex h-9 items-center gap-2.5 rounded-full bg-desk px-3 focus-within:ring-2 focus-within:ring-cta">
          <Search aria-hidden className="size-3.75 shrink-0 text-ink-3" />
          <span className="sr-only">Pesquisar conversa ou chamado</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar conversa ou chamado"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3"
          />
        </label>

        <div role="group" aria-label="Filtrar conversas" className="flex flex-wrap gap-1">
          {CONSOLE_FILTERS.map((option) => {
            const active = option === filter;
            const total =
              option === "all"
                ? null
                : conversations.filter((item) => matchesFilter(item, option, analystId)).length;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(option)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full px-2.25 py-1.5 text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-cta ${
                  active ? "bg-primary-soft text-primary-text" : "bg-desk text-ink-2 hover:bg-rule"
                }`}
              >
                {CONSOLE_FILTER_LABEL[option]}
                {total !== null && (
                  <span
                    className={`font-semibold ${active || (option === "waiting" && total > 0) ? "text-primary-text" : "text-ink-3"}`}
                  >
                    {total}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {stale && (
          <p role="status" className="text-[12px] text-warning-text">
            Sem conexão com o servidor. Mostrando a última atualização.
          </p>
        )}
      </header>

      <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
        {visible.map((conversation) => (
          <li key={conversation.id}>
            <ConversationRow
              conversation={conversation}
              analystId={analystId}
              selected={conversation.id === selectedId}
              now={now}
              onSelect={() => onSelect(conversation.id)}
            />
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-4 py-10 text-center text-[13.5px] text-ink-3">
            {conversations.length === 0
              ? "Nenhuma conversa ainda. Elas aparecem aqui assim que um funcionário escrever."
              : "Nenhuma conversa neste filtro."}
          </li>
        )}
      </ul>
    </section>
  );
}

const TAG_CLASS: Record<ConversationTag["tone"], { dot: string; text: string }> = {
  danger: { dot: "bg-danger", text: "text-danger-text" },
  warning: { dot: "bg-warning", text: "text-warning-text" },
  cta: { dot: "bg-cta", text: "text-primary-text" },
  success: { dot: "bg-success", text: "text-ink-3" },
  faint: { dot: "bg-ink/33", text: "text-ink-3" },
};

type ConversationRowProps = {
  conversation: ConversationItem;
  analystId: string;
  selected: boolean;
  now: Date;
  onSelect(): void;
};

function ConversationRow({ conversation, analystId, selected, now, onSelect }: ConversationRowProps) {
  const attention = needsAttention(conversation, analystId);
  const tag = conversationTag(conversation, analystId);
  const preview = messagePreview(conversation, analystId);
  const at = new Date(conversation.lastMessage?.createdAt ?? conversation.updatedAt);
  const showUnread =
    conversation.unanswered > 0 &&
    (conversation.status === "awaiting_analyst" || conversation.status === "with_analyst");

  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      className={`group flex w-full cursor-pointer items-start gap-3 rounded-[12px] p-2.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cta ${
        selected ? "bg-desk" : "hover:bg-desk/60"
      }`}
    >
      <span
        aria-hidden
        className={`flex size-11.5 shrink-0 items-center justify-center rounded-full text-[15.5px] font-semibold ${avatarColor(conversation.employee.id)}`}
      >
        {initials(conversation.employee.name)}
      </span>
      <span
        className={`flex min-w-0 flex-1 flex-col gap-0.75 border-b pb-2.5 ${selected ? "border-transparent" : "border-rule"}`}
      >
        <span className="flex items-baseline gap-2">
          <span
            className={`min-w-0 flex-1 truncate text-[15.5px] text-ink ${attention ? "font-semibold" : "font-medium"}`}
          >
            {conversation.employee.name}
          </span>
          <span
            className={`shrink-0 text-[12.5px] ${attention ? "font-semibold text-cta" : "text-ink-3"}`}
          >
            {formatListTime(at, now)}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          {preview?.author && (
            <CheckCheck aria-hidden className="size-3.75 shrink-0 text-primary" />
          )}
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-3">
            {preview
              ? preview.author
                ? `${preview.author}: ${preview.text}`
                : preview.text
              : "Sem mensagens"}
          </span>
          {showUnread && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-cta px-1.5 text-[11.5px] font-bold text-white">
              {conversation.unanswered}
              <span className="sr-only"> sem resposta</span>
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.25 text-[11.5px] font-medium">
          <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${TAG_CLASS[tag.tone].dot}`} />
          <span className={`truncate ${TAG_CLASS[tag.tone].text}`}>{tag.label}</span>
        </span>
      </span>
    </button>
  );
}
