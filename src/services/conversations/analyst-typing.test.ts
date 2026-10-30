import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/client";
import { createTestDatabase } from "@/db/test-database";
import { createConsoleService, type ConsoleService } from "./console-service";
import {
  ANALYST_TYPING_TTL_MS,
  ConversationStateError,
  createConversationService,
  type ConversationService,
} from "./conversation-service";

const MARINA = { id: "emp-marina", name: "Marina Alves" };
const OTHER_ANALYST = { id: "emp-other", name: "Rafael Lima" };
const CONVERSATION = "conv-ana";

describe("analyst typing", () => {
  let db: Database;
  let conversations: ConversationService;
  let console_: ConsoleService;
  let clock: number;

  beforeEach(async () => {
    clock = Date.UTC(2026, 9, 28, 12);
    const now = () => new Date(clock);
    db = await createTestDatabase(new Date(clock));
    conversations = createConversationService({ db, now });
    console_ = createConsoleService({ db, now });
    await conversations.getOrCreate("emp-ana", CONVERSATION);
    await console_.assume(CONVERSATION, MARINA);
  });

  const typingAnalyst = async () =>
    conversations.findTypingAnalyst(await conversations.get("emp-ana", CONVERSATION));

  it("names the analyst until the signal expires", async () => {
    expect(await typingAnalyst()).toBeNull();

    await console_.markTyping(CONVERSATION, MARINA);
    clock += ANALYST_TYPING_TTL_MS - 1;
    expect(await typingAnalyst()).toBe(MARINA.name);

    clock += 1;
    expect(await typingAnalyst()).toBeNull();
  });

  it("stops as soon as the reply is sent", async () => {
    await console_.markTyping(CONVERSATION, MARINA);
    await console_.reply(CONVERSATION, MARINA, "Oi, Ana!");

    expect(await typingAnalyst()).toBeNull();
  });

  it("stops when the analyst gives the conversation back", async () => {
    await console_.markTyping(CONVERSATION, MARINA);
    await console_.release(CONVERSATION, MARINA);

    expect(await typingAnalyst()).toBeNull();
  });

  it("ignores an analyst who did not take the conversation", async () => {
    await console_.markTyping(CONVERSATION, OTHER_ANALYST);

    expect(await typingAnalyst()).toBeNull();
  });

  it("does not move the conversation up the list", async () => {
    const before = await console_.get(CONVERSATION);
    clock += 1000;
    await console_.markTyping(CONVERSATION, MARINA);

    expect((await console_.get(CONVERSATION)).updatedAt).toEqual(before.updatedAt);
  });
});

describe("getTaken", () => {
  it("refuses anyone but the analyst who took the conversation", async () => {
    const now = () => new Date(Date.UTC(2026, 9, 28, 12));
    const db = await createTestDatabase(now());
    const service = createConsoleService({ db, now });
    await createConversationService({ db, now }).getOrCreate("emp-ana", CONVERSATION);

    await expect(service.getTaken(CONVERSATION, MARINA)).rejects.toBeInstanceOf(
      ConversationStateError,
    );
    await service.assume(CONVERSATION, MARINA);
    expect((await service.getTaken(CONVERSATION, MARINA)).employeeId).toBe("emp-ana");
    await expect(service.getTaken(CONVERSATION, OTHER_ANALYST)).rejects.toBeInstanceOf(
      ConversationStateError,
    );
  });
});
