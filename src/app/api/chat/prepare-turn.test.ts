import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/client";
import { conversations as conversationsTable } from "@/db/schema";
import { createTestDatabase } from "@/db/test-database";
import {
  ConversationNotFoundError,
  createConversationService,
  type ConversationService,
} from "@/services/conversations";
import { MAX_EMPLOYEE_MESSAGES, prepareChatTurn } from "./prepare-turn";

const TURN = { employeeId: "emp-ana", conversationId: "conv-1", text: "minha VPN caiu" };

describe("prepareChatTurn", () => {
  let db: Database;
  let conversations: ConversationService;

  beforeEach(async () => {
    db = await createTestDatabase(new Date());
    conversations = createConversationService({ db });
  });

  it("lets the agent answer a conversation with the agent", async () => {
    expect(await prepareChatTurn(conversations, TURN)).toEqual({ kind: "agent" });
    expect(await conversations.countMessages("conv-1", "employee")).toBe(1);
  });

  it.each(["awaiting_analyst", "with_analyst", "closed"] as const)(
    "keeps the agent silent when the conversation is %s",
    async (status) => {
      await conversations.getOrCreate("emp-ana", "conv-1");
      await db
        .update(conversationsTable)
        .set({ status })
        .where(eq(conversationsTable.id, "conv-1"));

      expect(await prepareChatTurn(conversations, TURN)).toEqual({ kind: "paused", status });
      // The analyst still gets the message
      expect(await conversations.countMessages("conv-1", "employee")).toBe(1);
    },
  );

  it("stops after the session message limit", async () => {
    for (let i = 0; i < MAX_EMPLOYEE_MESSAGES; i++) {
      expect(await prepareChatTurn(conversations, TURN)).toEqual({ kind: "agent" });
    }
    expect(await prepareChatTurn(conversations, TURN)).toEqual({ kind: "limit_reached" });
  });

  it("refuses another employee's conversation", async () => {
    await conversations.getOrCreate("emp-bruno", "conv-1");
    await expect(prepareChatTurn(conversations, TURN)).rejects.toThrow(
      ConversationNotFoundError,
    );
  });
});
