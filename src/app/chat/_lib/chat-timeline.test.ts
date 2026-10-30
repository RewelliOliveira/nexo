import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import type { ServiceDeskMessage } from "./chat-state";
import { mergeChat, withCreatedAt } from "./chat-timeline";

function agent(id: string, role: UIMessage["role"], at?: string): UIMessage {
  const message: UIMessage = { id, role, parts: [{ type: "text", text: id }] };
  return at ? withCreatedAt(message, new Date(at)) : message;
}

function desk(id: string, role: ServiceDeskMessage["role"], at: string): ServiceDeskMessage {
  return { id, role, content: id, authorName: null, createdAt: new Date(at).toISOString() };
}

const ids = (items: ReturnType<typeof mergeChat>) => items.map((item) => item.message.id);

describe("mergeChat", () => {
  it("places the service desk exchange where it happened", () => {
    const items = mergeChat(
      [
        agent("oi", "user", "2026-10-28T10:00:00Z"),
        agent("transferi", "assistant", "2026-10-28T10:01:00Z"),
        agent("voltei", "user", "2026-10-28T10:30:00Z"),
        agent("olá de novo", "assistant", "2026-10-28T10:30:05Z"),
      ],
      [
        desk("devolveu", "system", "2026-10-28T10:20:00Z"),
        desk("assumiu", "system", "2026-10-28T10:05:00Z"),
        desk("analista", "analyst", "2026-10-28T10:06:00Z"),
      ],
    );
    expect(ids(items)).toEqual([
      "oi",
      "transferi",
      "assumiu",
      "analista",
      "devolveu",
      "voltei",
      "olá de novo",
    ]);
    expect(items[0]).toMatchObject({ kind: "agent", index: 0 });
    expect(items[6]).toMatchObject({ kind: "agent", index: 3 });
  });

  it("keeps a message just sent after what the service desk already said", () => {
    const items = mergeChat(
      [agent("transferi", "assistant", "2026-10-28T10:01:00Z"), agent("voltei", "user")],
      [desk("devolveu", "system", "2026-10-28T10:20:00Z")],
    );
    expect(ids(items)).toEqual(["transferi", "devolveu", "voltei"]);
  });

  it("dates an unstamped message by the reply that follows it", () => {
    const items = mergeChat(
      [agent("voltei", "user"), agent("transferi", "assistant", "2026-10-28T10:31:00Z")],
      [
        desk("devolveu", "system", "2026-10-28T10:20:00Z"),
        desk("assumiu", "system", "2026-10-28T10:40:00Z"),
      ],
    );
    expect(ids(items)).toEqual(["devolveu", "voltei", "transferi", "assumiu"]);
  });
});
