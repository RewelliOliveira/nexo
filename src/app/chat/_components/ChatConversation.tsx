"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { TopBar } from "../../_components/AppShell";
import { MAX_EMPLOYEE_MESSAGES } from "../../api/chat/prepare-turn";
import { chatStateSchema, type ChatState } from "../_lib/chat-state";
import { textOf } from "../_lib/tool-parts";
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
};

export function ChatConversation({
  conversationId,
  initialMessages,
  initialState,
}: ChatConversationProps) {
  const [state, setState] = useState(initialState);
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

  const busy = status === "submitted" || status === "streaming";
  const last = messages.at(-1);
  const thinking = busy && (last?.role !== "assistant" || !hasContent(last));

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, thinking]);

  function send(text: string) {
    if (busy) return;
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
            {messages.map((message) =>
              message.role === "user" ? (
                <UserMessage key={message.id} text={textOf(message)} />
              ) : (
                <AgentMessage key={message.id} message={message} />
              ),
            )}
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
