import type { Metadata } from "next";
import { Suspense } from "react";
import { getConversationService } from "@/services/conversations";
import { AppShell } from "../_components/AppShell";
import { requireEmployee } from "../_lib/auth";
import { ChatScreen } from "./_components/ChatScreen";
import { EMPTY_CHAT_STATE } from "./_lib/chat-state";
import { loadChatHistory, loadChatState } from "./_lib/load-chat";

export const metadata: Metadata = { title: "Atendimento · Nexo Assist" };

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <Chat />
    </Suspense>
  );
}

async function Chat() {
  const employee = await requireEmployee("employee");
  // Coming back continues the last conversation, unless it was closed
  const latest = await getConversationService().findLatest(employee.id);
  const resumed = latest && latest.status !== "closed" ? latest : undefined;
  const conversationId = resumed?.id ?? crypto.randomUUID();
  const [initialState, initialMessages] = resumed
    ? await Promise.all([
        loadChatState(employee.id, conversationId),
        loadChatHistory(employee.id, conversationId),
      ])
    : [EMPTY_CHAT_STATE, []];

  return (
    <AppShell employee={employee}>
      <ChatScreen
        conversationId={conversationId}
        initialMessages={initialMessages}
        initialState={initialState}
        renderedAt={new Date().toISOString()}
      />
    </AppShell>
  );
}

function ChatSkeleton() {
  return (
    <div role="status" className="flex h-dvh bg-paper">
      <span className="sr-only">Carregando sua conversa…</span>
      <div aria-hidden className="hidden w-58 shrink-0 border-r border-rule md:block" />
      <div aria-hidden className="flex flex-1 flex-col">
        <div className="h-16 border-b border-rule" />
        <div className="mx-auto flex w-full max-w-202 animate-pulse flex-col gap-5 px-6 pt-7">
          <div className="h-11 w-72 self-end rounded-[12px_12px_4px_12px] bg-desk" />
          <div className="h-20 w-full max-w-150 rounded-[4px_12px_12px_12px] bg-desk" />
          <div className="h-11 w-60 self-end rounded-[12px_12px_4px_12px] bg-desk" />
        </div>
      </div>
    </div>
  );
}
