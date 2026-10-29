"use client";

import { useState } from "react";
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
          initialState: { status: "with_agent", employeeMessages: 0, decisions: [] },
          renderedAt: new Date().toISOString(),
        })
      }
    />
  );
}
