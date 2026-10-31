"use client";

import { useChat } from "@ai-sdk/react";
import { AlertTriangle, CircleSlash, Headset, LogIn, RotateCcw } from "lucide-react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConversationStatus } from "@/lib/domain";
import { TopBar } from "../../_components/AppShell";
import { Button } from "../../_components/Button";
import { MAX_EMPLOYEE_MESSAGES } from "../../api/chat/prepare-turn";
import { describeChatError, isAgentPaused } from "../_lib/chat-errors";
import { chatStateSchema, type ChatState, type DecisionView } from "../_lib/chat-state";
import { mergeChat } from "../_lib/chat-timeline";
import { textOf, toolCallsOf } from "../_lib/tool-parts";
import type { DecisionIndex } from "./AgentActions";
import { AgentMessage, AgentThinking, UserMessage } from "./AgentMessage";
import { ChatNotice, NewConversationButton } from "./ChatNotice";
import { Composer, type ComposerHandle } from "./Composer";
import { AnalystTyping, ServiceDeskMessage } from "./ServiceDeskMessage";

// The server keeps the history in the agent memory: only the new message goes
const transport = new DefaultChatTransport<UIMessage>({
  api: "/api/chat",
  prepareSendMessagesRequest: ({ id, messages }) => ({
    body: { id, messages: messages.slice(-1) },
  }),
});

export type ChatConversationProps = {
  conversationId: string;
  initialMessages: UIMessage[];
  initialState: ChatState;
  /** When the server rendered the page, ISO; reference for "há 5 dias" */
  renderedAt: string;
  onStartNew(): void;
};

/** From here on the counter warns that the session is ending. */
const LIMIT_WARNING_AT = MAX_EMPLOYEE_MESSAGES - 5;

/** Fast enough for the typing dots to follow the analyst */
const ANALYST_POLL_INTERVAL_MS = 2000;
const AWAITING_POLL_INTERVAL_MS = 5000;
/** With the agent, polling only notices an analyst taking over */
const AGENT_POLL_INTERVAL_MS = 15000;

const SEND_FAILED = "Não consegui enviar sua mensagem. Confira a conexão e tente de novo.";

export function ChatConversation({
  conversationId,
  initialMessages,
  initialState,
  renderedAt,
  onStartNew,
}: ChatConversationProps) {
  const [state, setState] = useState(initialState);
  const now = useMemo(() => new Date(renderedAt), [renderedAt]);
  const composerRef = useRef<ComposerHandle>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const refreshState = useCallback(async () => {
    try {
      const response = await fetch(`/api/chat/${conversationId}`, { cache: "no-store" });
      const parsed = chatStateSchema.safeParse(await response.json());
      if (response.ok && parsed.success) setState(parsed.data);
    } catch {
      // Keeps the last known state; the next reply refreshes it again
    }
  }, [conversationId]);

  const { messages, setMessages, sendMessage, regenerate, clearError, status, error } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport,
    onFinish: () => void refreshState(),
    onError: (failure) => {
      // Taken by an analyst meanwhile: the message was kept for them and
      // comes back with the service desk messages
      if (isAgentPaused(failure)) {
        setMessages((current) => (current.at(-1)?.role === "user" ? current.slice(0, -1) : current));
      }
      void refreshState();
    },
  });

  const [deskSending, setDeskSending] = useState(false);
  const [deskError, setDeskError] = useState<string | null>(null);
  const decisions = useMemo(() => indexDecisions(state.decisions), [state.decisions]);
  const ticketsByDraft = useMemo(() => indexTicketsByDraft(messages), [messages]);
  const items = useMemo(() => mergeChat(messages, state.serviceDesk), [messages, state.serviceDesk]);
  const busy = status === "submitted" || status === "streaming";
  const limitReached = state.employeeMessages >= MAX_EMPLOYEE_MESSAGES;
  const nearLimit = state.employeeMessages >= LIMIT_WARNING_AT && !limitReached;
  const open = state.status === "with_agent" && !limitReached;
  const left = MAX_EMPLOYEE_MESSAGES - state.employeeMessages;
  const last = messages.at(-1);
  const thinking = busy && (last?.role !== "assistant" || !hasContent(last));
  const failure = error ? describeChatError(error) : null;

  // With an analyst nothing streams back: polling brings the analyst's
  // messages and shows when the conversation goes back to the agent or closes.
  // With the agent it only notices an analyst taking over
  const withAnalyst = state.status === "awaiting_analyst" || state.status === "with_analyst";
  const pollEvery =
    state.status === "closed" || busy
      ? null
      : state.status === "with_analyst"
        ? ANALYST_POLL_INTERVAL_MS
        : withAnalyst
          ? AWAITING_POLL_INTERVAL_MS
          : AGENT_POLL_INTERVAL_MS;
  useEffect(() => {
    if (pollEvery === null) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshState();
    }, pollEvery);
    return () => window.clearInterval(id);
  }, [pollEvery, refreshState]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
    // Also when buttons or a notice appear under the reply after the stream
  }, [
    messages,
    thinking,
    status,
    state.status,
    state.serviceDesk.length,
    state.typingAnalyst,
    error,
    deskError,
  ]);

  function send(text: string): void | Promise<boolean> {
    if (withAnalyst) return sendToServiceDesk(text);
    if (busy || !open) return;
    clearError();
    setState((current) => ({ ...current, employeeMessages: current.employeeMessages + 1 }));
    void sendMessage({ text });
  }

  /** While the agent is paused the message goes straight to the analyst. */
  async function sendToServiceDesk(text: string): Promise<boolean> {
    setDeskSending(true);
    setDeskError(null);
    let delivered = false;
    try {
      const response = await fetch(`/api/chat/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      delivered = response.ok;
      // A 409 means the conversation left the analyst: the refresh explains it
      if (!response.ok && response.status !== 409) setDeskError(SEND_FAILED);
    } catch {
      setDeskError(SEND_FAILED);
    }
    await refreshState();
    setDeskSending(false);
    return delivered;
  }

  function retry() {
    clearError();
    void regenerate();
  }

  return (
    <>
      <TopBar current="Atendimento" aside={<ConversationStatusPill status={state.status} />} />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            role="log"
            aria-live="polite"
            aria-busy={busy}
            className="mx-auto flex w-full max-w-202 flex-col gap-5 px-4 pt-7 pb-1 sm:px-6"
          >
            {items.length === 0 && <EmptyConversation />}
            {items.map((item, position) => {
              if (item.kind === "service_desk") {
                return <ServiceDeskMessage key={item.message.id} message={item.message} />;
              }
              const { message, index } = item;
              if (message.role === "user") {
                return <UserMessage key={message.id} text={textOf(message)} />;
              }
              const next = messages[index + 1];
              // Quick replies stop working once the service desk said something after
              const latest = position === items.length - 1;
              // A reply that failed before saying anything is shown as the error below
              if (!hasContent(message) && !(busy && latest)) return null;
              return (
                <AgentMessage
                  key={message.id}
                  message={message}
                  decisions={decisions}
                  latest={latest}
                  interactive={latest && !busy && open}
                  nextUserText={next?.role === "user" ? textOf(next) : null}
                  ticketsByDraft={ticketsByDraft}
                  now={now}
                  onSend={send}
                  onCorrectDraft={() =>
                    composerRef.current?.focus("O que você quer corrigir no rascunho?")
                  }
                />
              );
            })}
            {thinking && <AgentThinking />}
            {state.typingAnalyst && <AnalystTyping name={state.typingAnalyst} />}
            {failure?.kind === "retry" && (
              <ChatNotice
                role="alert"
                tone="danger"
                icon={AlertTriangle}
                title={failure.title}
                action={
                  <Button variant="secondary" onClick={retry}>
                    <RotateCcw aria-hidden />
                    Tentar novamente
                  </Button>
                }
              >
                {failure.message}
              </ChatNotice>
            )}
            {failure?.kind === "signed_out" && (
              <ChatNotice
                role="alert"
                tone="warning"
                icon={LogIn}
                title="Sua sessão terminou"
                action={
                  <a
                    href="/login"
                    className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-cta px-3.5 text-[13.5px] font-semibold text-white hover:bg-cta/90"
                  >
                    Entrar de novo
                  </a>
                }
              >
                {failure.message}
              </ChatNotice>
            )}
            {failure?.kind === "daily_limit" && (
              <ChatNotice
                role="alert"
                tone="neutral"
                icon={CircleSlash}
                title="Limite diário atingido"
              >
                {failure.message}
              </ChatNotice>
            )}
            {deskError && (
              <ChatNotice
                role="alert"
                tone="danger"
                icon={AlertTriangle}
                title="Sua mensagem não chegou ao analista"
              >
                {deskError}
              </ChatNotice>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-202 flex-col gap-1.5 px-4 pt-2.5 pb-4.5 sm:px-6">
          {state.status !== "with_agent" ? (
            <PausedNotice status={state.status} onStartNew={onStartNew} />
          ) : (
            limitReached && (
              <ChatNotice
                tone="neutral"
                icon={CircleSlash}
                title="Você chegou ao limite de 30 mensagens desta conversa"
                action={<NewConversationButton onClick={onStartNew} />}
              >
                Seus chamados continuam salvos. Comece uma nova conversa para seguir com o Nexo
                Assist.
              </ChatNotice>
            )
          )}
          <Composer
            ref={composerRef}
            onSend={send}
            busy={withAnalyst ? deskSending : busy}
            disabledReason={composerBlockedReason(state.status, limitReached)}
            placeholder={withAnalyst ? "Escreva para o analista…" : undefined}
            label={withAnalyst ? "Mensagem para o analista" : undefined}
          />
          <p
            className={`text-right text-[12.5px] ${nearLimit ? "font-medium text-warning-text" : "text-ink-3"}`}
          >
            {state.employeeMessages}/{MAX_EMPLOYEE_MESSAGES} mensagens nesta sessão
            {nearLimit && ` · ${left === 1 ? "resta 1" : `restam ${left}`}`}
          </p>
        </div>
      </div>
    </>
  );
}

function indexTicketsByDraft(messages: UIMessage[]): Map<string, string> {
  const tickets = new Map<string, string>();
  for (const message of messages) {
    for (const call of toolCallsOf(message)) {
      if (call.draftId && call.state === "done" && call.result?.tool === "createTicket") {
        tickets.set(call.draftId, call.result.data.ticket.id);
      }
    }
  }
  return tickets;
}

function indexDecisions(decisions: DecisionView[]): DecisionIndex {
  const byId = new Map(decisions.map((decision) => [decision.id, decision]));
  const byParent = new Map<string, DecisionView[]>();
  for (const decision of decisions) {
    if (!decision.parentId) continue;
    byParent.set(decision.parentId, [...(byParent.get(decision.parentId) ?? []), decision]);
  }
  return { byId, byParent };
}

function hasContent(message: UIMessage): boolean {
  return message.parts.some(
    (part) => (part.type === "text" && part.text.trim() !== "") || part.type.startsWith("tool-"),
  );
}

function composerBlockedReason(
  status: ConversationStatus,
  limitReached: boolean,
): string | undefined {
  // With the service desk the employee keeps writing, whatever the limit
  if (status === "awaiting_analyst" || status === "with_analyst") return undefined;
  if (status === "closed") return "Conversa encerrada";
  if (limitReached) return "Limite de mensagens atingido";
  return undefined;
}

function PausedNotice({
  status,
  onStartNew,
}: {
  status: Exclude<ConversationStatus, "with_agent">;
  onStartNew(): void;
}) {
  if (status === "closed") {
    return (
      <ChatNotice
        tone="neutral"
        icon={CircleSlash}
        title="Esta conversa foi encerrada"
        action={<NewConversationButton onClick={onStartNew} />}
      >
        Se precisar de mais alguma coisa, comece uma nova conversa.
      </ChatNotice>
    );
  }
  if (status === "with_analyst") {
    return (
      <ChatNotice tone="primary" icon={Headset} title="Um analista assumiu sua conversa">
        Ele já tem o resumo do caso. Converse com ele por aqui; o Nexo Assist fica pausado.
      </ChatNotice>
    );
  }
  return (
    <ChatNotice tone="warning" icon={Headset} title="Conversa transferida para um analista">
      O analista recebeu o resumo do caso e vai continuar por aqui. Se quiser, já pode escrever:
      ele lê tudo ao assumir. Enquanto isso, o Nexo Assist não responde.
    </ChatNotice>
  );
}

const STATUS_PILL: Record<ConversationStatus, { label: string; box: string; dot: string }> = {
  with_agent: {
    label: "Assistente online",
    box: "bg-success-soft text-success-text",
    dot: "bg-success",
  },
  awaiting_analyst: {
    label: "Aguardando analista",
    box: "bg-warning-soft text-warning-text",
    dot: "bg-warning",
  },
  with_analyst: { label: "Com analista", box: "bg-primary-soft text-primary-text", dot: "bg-cta" },
  closed: { label: "Conversa encerrada", box: "bg-desk text-ink-3", dot: "bg-ink/25" },
};

function ConversationStatusPill({ status }: { status: ConversationStatus }) {
  const pill = STATUS_PILL[status];
  return (
    <span
      className={`flex items-center gap-1.75 rounded-full px-2.5 py-1.25 text-[12.5px] font-semibold ${pill.box}`}
    >
      <span aria-hidden className={`size-1.75 rounded-full ${pill.dot}`} />
      {pill.label}
    </span>
  );
}

function EmptyConversation() {
  return (
    <div className="flex flex-col gap-2 py-10 text-center">
      <p className="font-display text-3xl text-ink">Como posso ajudar?</p>
      <p className="text-[14.5px] text-ink-3">
        Descreva o problema ou pergunte pelos seus chamados. Eu consulto, abro e acompanho para
        você.
      </p>
    </div>
  );
}
