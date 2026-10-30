import type { Metadata } from "next";
import { Suspense } from "react";
import { ConversationNotFoundError } from "@/services/conversations";
import { requireEmployee } from "../_lib/auth";
import { ConsoleScreen } from "./_components/ConsoleScreen";
import { loadConversationDetail, loadConversationList } from "./_lib/load-console";
import { sortForConsole } from "./_lib/console-view";

export const metadata: Metadata = { title: "Console · Nexo Assist" };

type ConsolePageProps = { searchParams: Promise<{ conversa?: string | string[] }> };

export default function ConsolePage({ searchParams }: ConsolePageProps) {
  return (
    <Suspense fallback={<ConsoleSkeleton />}>
      <Console searchParams={searchParams} />
    </Suspense>
  );
}

async function Console({ searchParams }: ConsolePageProps) {
  const analyst = await requireEmployee("analyst");
  const [{ conversa }, conversations] = await Promise.all([searchParams, loadConversationList()]);
  // Opens the conversation in the link, else the one waiting the longest
  const requested = typeof conversa === "string" ? conversa : undefined;
  const selectedId = requested ?? sortForConsole(conversations)[0]?.id ?? null;
  const detail = selectedId ? await loadDetail(selectedId) : null;

  return (
    <div className="flex h-dvh bg-paper">
      <ConsoleScreen
        analyst={{ id: analyst.id, name: analyst.name, email: analyst.email }}
        initialConversations={conversations}
        initialSelectedId={detail ? selectedId : null}
        initialDetail={detail}
        renderedAt={new Date().toISOString()}
      />
    </div>
  );
}

async function loadDetail(conversationId: string) {
  try {
    return await loadConversationDetail(conversationId);
  } catch (error) {
    if (error instanceof ConversationNotFoundError) return null;
    throw error;
  }
}

function ConsoleSkeleton() {
  return (
    <div role="status" className="flex h-dvh bg-paper">
      <span className="sr-only">Carregando as conversas…</span>
      <div aria-hidden className="w-16 shrink-0 border-r border-rule bg-desk" />
      <div aria-hidden className="flex w-full flex-col gap-3 border-r border-rule p-4 lg:w-95">
        <div className="h-7 w-32 rounded-sm bg-desk" />
        <div className="h-9 rounded-full bg-desk" />
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex animate-pulse items-center gap-3 py-2">
            <div className="size-11.5 rounded-full bg-desk" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-3.5 w-1/2 rounded-sm bg-desk" />
              <div className="h-3 w-4/5 rounded-sm bg-desk" />
            </div>
          </div>
        ))}
      </div>
      <div aria-hidden className="hidden flex-1 bg-[#EEF1F5] lg:block" />
    </div>
  );
}
