"use client";

import { useState } from "react";
import { EMPTY_CHAT_STATE } from "../_lib/chat-state";
import { ChatConversation, type ChatConversationProps } from "./ChatConversation";

type ChatScreenProps = Omit<ChatConversationProps, "onStartNew">;

/** Holds the current conversation; starting a new one swaps it entirely. */
export function ChatScreen(initial: ChatScreenProps) {
  const [chat, setChat] = useState(initial);
  return (
    <ChatConversation
      key={chat.conversationId}
      {...chat}
      onStartNew={() =>
        setChat({
          conversationId: crypto.randomUUID(),
          initialMessages: [],
          initialState: EMPTY_CHAT_STATE,
          renderedAt: new Date().toISOString(),
        })
      }
    />
  );
}
