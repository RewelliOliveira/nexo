"use client";

import { MessagesSquare } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { z } from "zod";
import type { Employee } from "@/db/schema";
import {
  consoleListSchema,
  conversationDetailSchema,
  type ConversationDetail,
  type ConversationItem,
} from "../_lib/console-state";
import { usePolling } from "../_lib/use-polling";
import { ConsoleRail } from "./ConsoleRail";
import { ConversationList } from "./ConversationList";

type ConsoleScreenProps = {
  analyst: Pick<Employee, "id" | "name" | "email">;
  initialConversations: ConversationItem[];
  initialSelectedId: string | null;
  initialDetail: ConversationDetail | null;
  /** When the server rendered the page, ISO */
  renderedAt: string;
};

/** List of conversations and the open one, both kept fresh by polling. */
export function ConsoleScreen({
  analyst,
  initialConversations,
  initialSelectedId,
  initialDetail,
  renderedAt,
}: ConsoleScreenProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const [listStale, setListStale] = useState(false);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [detail, setDetail] = useState(initialDetail);
  const [now, setNow] = useState(() => new Date(renderedAt));
  // Answers for a conversation the analyst already left are dropped
  const selectedRef = useRef(initialSelectedId);

  const refreshList = useCallback(async () => {
    try {
      const data = await fetchJson("/api/console/conversations", consoleListSchema);
      setConversations(data.conversations);
      setListStale(false);
    } catch {
      setListStale(true);
    }
    setNow(new Date());
  }, []);

  const refreshDetail = useCallback(async (conversationId: string) => {
    try {
      const data = await fetchJson(
        `/api/console/conversations/${encodeURIComponent(conversationId)}`,
        conversationDetailSchema,
      );
      if (selectedRef.current === conversationId) setDetail(data);
    } catch {
      // Keeps the last state on screen; the next poll tries again
    }
  }, []);

  usePolling(() => {
    void refreshList();
    if (selectedRef.current) void refreshDetail(selectedRef.current);
  });

  function select(conversationId: string) {
    if (conversationId === selectedRef.current) return;
    selectedRef.current = conversationId;
    setSelectedId(conversationId);
    setDetail(null);
    const url = new URL(window.location.href);
    url.searchParams.set("conversa", conversationId);
    window.history.replaceState(null, "", url);
    void refreshDetail(conversationId);
  }

  return (
    <>
      <ConsoleRail
        analyst={analyst}
        waiting={conversations.filter((item) => item.status === "awaiting_analyst").length}
      />
      <ConversationList
        conversations={conversations}
        analystId={analyst.id}
        selectedId={selectedId}
        now={now}
        stale={listStale}
        onSelect={select}
        className={selectedId ? "hidden lg:flex" : "flex"}
      />
      <main className="hidden min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-[#EEF1F5] p-6 text-center lg:flex">
        <MessagesSquare aria-hidden className="size-8 text-ink-3" />
        <p className="text-[14.5px] text-ink-3">
          {detail ? detail.conversation.employee.name : "Escolha uma conversa na lista."}
        </p>
      </main>
    </>
  );
}

async function fetchJson<T extends z.ZodType>(url: string, schema: T): Promise<z.output<T>> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return schema.parse(await response.json());
}
