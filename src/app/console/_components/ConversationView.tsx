"use client";

import {
  ArrowLeft,
  ArrowRightLeft,
  Bot,
  CheckCheck,
  CircleCheck,
  CircleSlash,
  FileText,
  Hand,
  Headset,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "../../_components/Button";
import { formatTime } from "../../_lib/format";
import { Composer } from "../../chat/_components/Composer";
import { RichText } from "../../chat/_components/RichText";
import type {
  ConversationDetail,
  ConversationItem,
  HistoryMessage,
} from "../_lib/console-state";
import { avatarColor, firstName, handoffReasonLabel, initials } from "../_lib/console-view";
import { buildTimeline } from "../_lib/timeline";
import { DecisionTrail } from "./DecisionTrail";

export type ConsoleAction = "assume" | "release" | "close";

type ConversationViewProps = {
  detail: ConversationDetail;
  analystId: string;
  now: Date;
  /** Action being sent to the server */
  pending: ConsoleAction | null;
  error: string | null;
  onAction(action: ConsoleAction): void;
  /** Sends a message to the employee; false when it was not delivered */
  onReply(text: string): Promise<boolean>;
  /** The analyst is writing a reply */
  onTyping(): void;
  onBack(): void;
  /** Header button that shows the tickets panel when it is hidden */
  ticketsToggle?: ReactNode;
};

/** The open conversation: who it is, the history with decisions and what to do. */
export function ConversationView({
  detail,
  analystId,
  now,
  pending,
  error,
  onAction,
  onReply,
  onTyping,
  onBack,
  ticketsToggle,
}: ConversationViewProps) {
  const { conversation } = detail;
  const timeline = useMemo(() => buildTimeline(detail, now), [detail, now]);
  const mine = conversation.status === "with_analyst" && conversation.analystId === analystId;
  const endRef = useRef<HTMLDivElement>(null);
  const lastKey = timeline.at(-1)?.key;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conversation.id, lastKey]);

  const meta = [conversation.employee.department, conversation.handoffTicketId]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-[#EEF1F5]">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-rule bg-paper pr-4 pl-3 sm:pl-5">
        <button
          type="button"
          onClick={onBack}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-2 hover:bg-desk lg:hidden"
        >
          <ArrowLeft aria-hidden className="size-4.5" />
          <span className="sr-only">Voltar para a lista</span>
        </button>
        <span
          aria-hidden
          className={`flex size-10 shrink-0 items-center justify-center rounded-full text-[14.5px] font-semibold ${avatarColor(conversation.employee.id)}`}
        >
          {initials(conversation.employee.name)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="truncate text-[15.5px] font-semibold text-ink">
            {conversation.employee.name}
          </h2>
          {meta && <p className="truncate text-[12.5px] text-ink-3">{meta}</p>}
        </div>
        {mine ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              disabled={pending !== null}
              onClick={() => onAction("release")}
              className="max-sm:px-2.5"
            >
              <ActionIcon icon={Bot} busy={pending === "release"} />
              <span className="max-sm:sr-only">Devolver ao agent</span>
            </Button>
            <CloseButton pending={pending} onConfirm={() => onAction("close")} />
          </div>
        ) : (
          <StatusPill conversation={conversation} analystId={analystId} />
        )}
        {ticketsToggle}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ol
          aria-label={`Conversa com ${conversation.employee.name}`}
          className="mx-auto flex w-full max-w-215 flex-col px-4 pt-5 pb-4 sm:px-10"
        >
          {timeline.map((item) => {
            switch (item.kind) {
              case "day":
                return (
                  <li key={item.key} className="flex justify-center pt-1 pb-1">
                    <span className="rounded-full bg-paper/80 px-2.5 py-1 text-[12px] font-medium text-ink-3">
                      {item.label}
                    </span>
                  </li>
                );
              case "handoff":
                return (
                  <li key={item.key} className="flex flex-col gap-3">
                    <SystemLine icon={ArrowRightLeft}>
                      Transferida para um analista · {formatTime(new Date(item.at))}
                    </SystemLine>
                    <HandoffSummary conversation={conversation} />
                  </li>
                );
              case "pending":
                return (
                  <li key={item.key} className="flex flex-col items-end gap-1 pt-4">
                    <span className="px-1 text-[12px] text-ink-3">
                      Nexo Assist agiu sem responder ainda
                    </span>
                    <DecisionTrail decisions={item.decisions} />
                  </li>
                );
              case "message":
                return (
                  <li key={item.key}>
                    <HistoryEntry
                      message={item.message}
                      first={item.first}
                      conversation={conversation}
                    />
                  </li>
                );
            }
          })}
          {timeline.length === 0 && (
            <li className="py-10 text-center text-[13.5px] text-ink-3">Sem mensagens ainda.</li>
          )}
        </ol>
        <div ref={endRef} />
      </div>

      <ConversationFooter
        conversation={conversation}
        mine={mine}
        pending={pending}
        error={error}
        onAction={onAction}
        onReply={onReply}
        onTyping={onTyping}
      />
    </main>
  );
}

function HistoryEntry({
  message,
  first,
  conversation,
}: {
  message: HistoryMessage;
  first: boolean;
  conversation: ConversationItem;
}) {
  const time = formatTime(new Date(message.createdAt));
  if (message.role === "system") {
    return (
      <SystemLine icon={Headset}>
        {message.content} · {time}
      </SystemLine>
    );
  }

  if (message.role === "employee") {
    return (
      <div className={`flex ${first ? "pt-4" : "pt-0.75"}`}>
        <div
          className={`flex max-w-[min(560px,85%)] flex-wrap items-end gap-x-2.5 bg-paper px-3 pt-2 pb-1.5 text-[14.5px] text-ink ${first ? "rounded-[4px_12px_12px_12px]" : "rounded-[12px]"}`}
        >
          <p className="min-w-0 break-words whitespace-pre-wrap">{message.content}</p>
          <time dateTime={message.createdAt} className="ml-auto pb-px text-[11px] text-ink-3">
            {time}
          </time>
        </div>
      </div>
    );
  }

  const agent = message.role === "agent";
  return (
    <div className={`flex flex-col items-end gap-1 ${first ? "pt-4" : "pt-0.75"}`}>
      {first && (
        <p className="flex items-center gap-1.5 px-1 text-[12px] font-semibold text-ink-2">
          {agent ? "Nexo Assist" : (message.authorName ?? conversation.analystName ?? "Analista")}
          <span
            className={`rounded-sm px-1.5 py-px text-[11px] font-semibold ${agent ? "bg-primary-soft text-primary-text" : "bg-success-soft text-success-text"}`}
          >
            {agent ? "IA" : "Service desk"}
          </span>
        </p>
      )}
      {message.decisions.length > 0 && <DecisionTrail decisions={message.decisions} />}
      <div
        className={`flex max-w-[min(560px,85%)] flex-col gap-0.5 px-3 pt-2 pb-1.5 text-[14.5px] text-ink ${agent ? "bg-[#E6EFFA]" : "bg-[#E3F4EA]"} ${first ? "rounded-[12px_4px_12px_12px]" : "rounded-[12px]"}`}
      >
        <RichText text={message.content} />
        <span className="flex items-center justify-end gap-0.75 text-[11px] text-ink-3">
          <time dateTime={message.createdAt}>{time}</time>
          <CheckCheck aria-hidden className="size-3.5 text-primary" />
        </span>
      </div>
    </div>
  );
}

function SystemLine({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div role="note" className="flex items-center gap-3 pt-4.5 pb-1">
      <span aria-hidden className="h-px flex-1 bg-ink/8" />
      <span className="flex items-center gap-1.5 text-center text-[12px] font-medium text-ink-3">
        <Icon aria-hidden className="size-3.25 shrink-0" />
        {children}
      </span>
      <span aria-hidden className="h-px flex-1 bg-ink/8" />
    </div>
  );
}

/** What the agent handed over, so the analyst does not ask everything again. */
function HandoffSummary({ conversation }: { conversation: ConversationItem }) {
  if (!conversation.handoffSummary) return null;
  return (
    <section
      aria-label="Resumo da transferência"
      className="mx-auto flex w-full max-w-140 flex-col gap-2 rounded-[12px] border border-warning/30 bg-paper px-4 py-3"
    >
      <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-semibold text-ink">
        <FileText aria-hidden className="size-3.75 text-warning-text" />
        Resumo da transferência
        {conversation.handoffReason && (
          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11.5px] font-medium text-warning-text">
            {handoffReasonLabel(conversation.handoffReason)}
          </span>
        )}
        {conversation.handoffConfidence !== null && (
          <span className="text-[11.5px] font-normal text-ink-3">
            confiança do agent {Math.round(conversation.handoffConfidence * 100)}%
          </span>
        )}
      </h3>
      <p className="text-[13.5px] leading-normal whitespace-pre-wrap text-ink-2">
        {conversation.handoffSummary}
      </p>
    </section>
  );
}

const PILL: Record<ConversationItem["status"], { icon: LucideIcon; box: string }> = {
  awaiting_analyst: { icon: Bot, box: "bg-warning-soft text-warning-text" },
  with_agent: { icon: Bot, box: "bg-success-soft text-success-text" },
  with_analyst: { icon: Headset, box: "bg-primary-soft text-primary-text" },
  closed: { icon: CircleSlash, box: "bg-desk text-ink-3" },
};

function StatusPill({
  conversation,
  analystId,
}: {
  conversation: ConversationItem;
  analystId: string;
}) {
  const label = {
    awaiting_analyst: "Aguardando atendente",
    with_agent: "Agent atendendo",
    with_analyst:
      conversation.analystId === analystId
        ? "Você está atendendo"
        : `Com ${firstName(conversation.analystName ?? "outro analista")}`,
    closed: "Encerrada",
  }[conversation.status];
  const { icon: Icon, box } = PILL[conversation.status];
  return (
    <span
      className={`flex shrink-0 items-center gap-1.75 rounded-full px-2.75 py-1.5 text-[12.5px] font-semibold ${box}`}
    >
      <Icon aria-hidden className="size-3.5" />
      <span className="max-sm:sr-only">{label}</span>
    </span>
  );
}

/** Closing ends the conversation for the employee too, so it asks once more. */
function CloseButton({
  pending,
  onConfirm,
}: {
  pending: ConsoleAction | null;
  onConfirm(): void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (confirming && pending === null) {
    return (
      <span role="group" aria-label="Confirmar encerramento" className="flex items-center gap-1">
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
        <button
          type="button"
          autoFocus
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[8px] bg-danger px-3 text-[13.5px] font-semibold text-white hover:bg-danger/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
        >
          Encerrar mesmo
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={pending !== null}
      onClick={() => setConfirming(true)}
      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[8px] bg-danger-soft px-3 text-[13.5px] font-semibold text-danger-text hover:bg-danger/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-not-allowed disabled:opacity-60 max-sm:px-2.5"
    >
      {pending === "close" ? (
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
      ) : (
        <CircleCheck aria-hidden className="size-3.5" />
      )}
      <span className="max-sm:sr-only">Encerrar atendimento</span>
    </button>
  );
}

type FooterProps = {
  conversation: ConversationItem;
  mine: boolean;
  pending: ConsoleAction | null;
  error: string | null;
  onAction(action: ConsoleAction): void;
  onReply(text: string): Promise<boolean>;
  onTyping(): void;
};

function ConversationFooter({
  conversation,
  mine,
  pending,
  error,
  onAction,
  onReply,
  onTyping,
}: FooterProps) {
  const name = firstName(conversation.employee.name);
  const handoffTime = conversation.handedOffAt
    ? formatTime(new Date(conversation.handedOffAt))
    : null;

  let bar: ReactNode;
  switch (conversation.status) {
    case "awaiting_analyst":
      bar = (
        <FooterRow
          icon={Hand}
          tone="bg-warning-soft text-warning-text"
          title={`${name} espera um atendente`}
          body={`Agent pausado${handoffTime ? ` · transferida às ${handoffTime}` : ""}`}
        >
          <ReleaseButton pending={pending} onClick={() => onAction("release")} />
          <AssumeButton pending={pending} onClick={() => onAction("assume")} />
        </FooterRow>
      );
      break;
    case "with_agent":
      bar = (
        <FooterRow
          icon={Bot}
          tone="bg-success-soft text-success-text"
          title={`Nexo Assist está atendendo ${name}`}
          body="Assuma para pausar o agent e cuidar do caso você mesmo"
        >
          <AssumeButton pending={pending} onClick={() => onAction("assume")} />
        </FooterRow>
      );
      break;
    case "with_analyst":
      // The agent is paused: whoever took the conversation answers here
      bar = mine ? (
        <Composer
          onSend={onReply}
          onTyping={onTyping}
          busy={pending !== null}
          placeholder={`Escreva para ${name}…`}
          label={`Mensagem para ${conversation.employee.name}`}
        />
      ) : (
        <FooterRow
          icon={Headset}
          tone="bg-primary-soft text-primary-text"
          title={`${conversation.analystName ?? "Outro analista"} está atendendo`}
          body="Só quem assumiu pode responder, devolver ou encerrar esta conversa."
        />
      );
      break;
    case "closed":
      bar = (
        <FooterRow
          icon={CircleSlash}
          tone="bg-desk text-ink-3"
          title="Atendimento encerrado"
          body={`${name} pode começar uma nova conversa quando precisar.`}
        />
      );
      break;
  }

  return (
    <div className="@container flex shrink-0 flex-col gap-2.5 border-t border-rule bg-paper px-4 pt-3 pb-3.5 sm:px-5">
      {error && (
        <p role="alert" className="rounded-[8px] bg-danger-soft px-3 py-2 text-[13px] text-danger-text">
          {error}
        </p>
      )}
      {bar}
    </div>
  );
}

function FooterRow({
  icon: Icon,
  tone,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 @2xl:flex-nowrap">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon aria-hidden className="size-4.25" />
      </span>
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
        <p className="text-[14.5px] font-semibold text-ink">{title}</p>
        <p className="text-[12.5px] text-ink-3">{body}</p>
      </div>
      {children && <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

function AssumeButton({ pending, onClick }: { pending: ConsoleAction | null; onClick(): void }) {
  return (
    <Button disabled={pending !== null} onClick={onClick}>
      <ActionIcon icon={Headset} busy={pending === "assume"} />
      Assumir atendimento
    </Button>
  );
}

function ReleaseButton({ pending, onClick }: { pending: ConsoleAction | null; onClick(): void }) {
  return (
    <Button variant="secondary" disabled={pending !== null} onClick={onClick}>
      <ActionIcon icon={Bot} busy={pending === "release"} />
      Devolver ao agent
    </Button>
  );
}

function ActionIcon({ icon: Icon, busy }: { icon: LucideIcon; busy: boolean }) {
  return busy ? <Loader2 aria-hidden className="animate-spin" /> : <Icon aria-hidden />;
}
