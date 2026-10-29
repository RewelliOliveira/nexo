"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TopBar } from "../../_components/AppShell";
import { MAX_EMPLOYEE_MESSAGES } from "../../api/chat/prepare-turn";
import { chatStateSchema, type ChatState, type DecisionView } from "../_lib/chat-state";
import { textOf, toolCallsOf } from "../_lib/tool-parts";
import type { DecisionIndex } from "./AgentActions";
import { AgentMessage, AgentThinking, UserMessage } from "./AgentMessage";
import { Composer, type ComposerHandle } from "./Composer";

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
};

export function ChatConversation({
  conversationId,
  initialMessages,
  initialState,
  renderedAt,
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

  const { messages, sendMessage, status } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport,
    onFinish: () => void refreshState(),
    onError: () => void refreshState(),
  });

  const decisions = useMemo(() => indexDecisions(state.decisions), [state.decisions]);
  const ticketsByDraft = useMemo(() => indexTicketsByDraft(messages), [messages]);
  const busy = status === "submitted" || status === "streaming";
  const open = state.status === "with_agent" && state.employeeMessages < MAX_EMPLOYEE_MESSAGES;
  const last = messages.at(-1);
  const thinking = busy && (last?.role !== "assistant" || !hasContent(last));

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
    // status too: buttons appear under the reply once the stream ends
  }, [messages, thinking, status]);

  function send(text: string) {
    if (busy || !open) return;
    setState((current) => ({ ...current, employeeMessages: current.employeeMessages + 1 }));
    void sendMessage({ text });
  }

  return (
    <>
      <TopBar current="Atendimento" aside={<AssistantStatus />} />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            role="log"
            aria-live="polite"
            aria-busy={busy}
            className="mx-auto flex w-full max-w-202 flex-col gap-5 px-4 pt-7 pb-1 sm:px-6"
          >
            {messages.length === 0 && <EmptyConversation />}
            {messages.map((message, index) => {
              if (message.role === "user") {
                return <UserMessage key={message.id} text={textOf(message)} />;
              }
              const next = messages[index + 1];
              const latest = index === messages.length - 1;
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
            <div ref={endRef} />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-202 flex-col gap-1.5 px-4 pt-2.5 pb-4.5 sm:px-6">
          <Composer ref={composerRef} onSend={send} busy={busy} />
          <p className="text-right text-[12.5px] text-ink-3">
            {state.employeeMessages}/{MAX_EMPLOYEE_MESSAGES} mensagens nesta sessão
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

function AssistantStatus() {
  return (
    <span className="flex items-center gap-1.75 rounded-full bg-success-soft px-2.5 py-1.25 text-[12.5px] font-semibold text-success-text">
      <span aria-hidden className="size-1.75 rounded-full bg-success" />
      Assistente online
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
