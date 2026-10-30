import type { UIMessage } from "ai";
import { z } from "zod";
import type { ServiceDeskMessage } from "./chat-state";

// The chat shows two sources: the agent memory (with tool calls) and the
// messages exchanged with the service desk, kept in the database. They never
// overlap in time, since only one of them talks at once, so they are merged
// by when each message was written.

export type ChatItem =
  | {
      kind: "agent";
      message: UIMessage;
      /** Position in the agent messages, to look at its neighbors */
      index: number;
    }
  | { kind: "service_desk"; message: ServiceDeskMessage };

const createdAtMetadataSchema = z.object({ createdAt: z.iso.datetime() });

/** Stamps when a message was written, for messages read from memory. */
export function withCreatedAt(message: UIMessage, createdAt: Date): UIMessage {
  const metadata = message.metadata !== null && typeof message.metadata === "object" ? message.metadata : {};
  return { ...message, metadata: { ...metadata, createdAt: createdAt.toISOString() } };
}

/** The server stamps each reply when its stream starts. */
export function createdAtMetadata(): { createdAt: string } {
  return { createdAt: new Date().toISOString() };
}

function stampOf(message: UIMessage): number | null {
  const parsed = createdAtMetadataSchema.safeParse(message.metadata);
  return parsed.success ? Date.parse(parsed.data.createdAt) : null;
}

export function mergeChat(messages: UIMessage[], serviceDesk: ServiceDeskMessage[]): ChatItem[] {
  // A message just sent has no stamp yet: it happened right before the
  // next stamped one (its reply), or it is the newest of all
  const times: number[] = new Array<number>(messages.length);
  let next = Number.POSITIVE_INFINITY;
  for (let i = messages.length - 1; i >= 0; i--) {
    next = stampOf(messages[i]) ?? next;
    times[i] = next;
  }

  const desk = [...serviceDesk].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const items: ChatItem[] = [];
  let d = 0;
  messages.forEach((message, index) => {
    while (d < desk.length && Date.parse(desk[d].createdAt) < times[index]) {
      items.push({ kind: "service_desk", message: desk[d++] });
    }
    items.push({ kind: "agent", message, index });
  });
  for (; d < desk.length; d++) items.push({ kind: "service_desk", message: desk[d] });
  return items;
}
