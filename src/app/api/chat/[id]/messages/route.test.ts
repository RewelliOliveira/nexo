import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDatabase } from "@/db/test-database";
import {
  createConsoleService,
  createConversationService,
  type ConversationService,
} from "@/services/conversations";
import { createTicketService } from "@/services/tickets";

const session = vi.hoisted(() => ({ employeeId: null as string | null }));
const services = vi.hoisted(() => ({ conversations: null as ConversationService | null }));

vi.mock("@/lib/session", () => ({
  getSessionEmployeeId: async () => session.employeeId,
}));
vi.mock("@/services/conversations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/conversations")>()),
  getConversationService: () => services.conversations,
}));

const { POST } = await import("./route");

function send(conversationId: string, body: unknown) {
  return POST(
    new Request(`http://localhost/api/chat/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: conversationId }) },
  );
}

describe("POST /api/chat/[id]/messages", () => {
  beforeEach(async () => {
    const db = await createTestDatabase(new Date());
    const conversations = createConversationService({ db });
    services.conversations = conversations;
    session.employeeId = "emp-ana";

    await conversations.getOrCreate("emp-ana", "conv-ana");
    await createTicketService({ db, failureRate: 0 }).handoff("emp-ana", {
      conversationId: "conv-ana",
      reason: "employee_request",
      summary: "Notebook lento",
    });
    await createConsoleService({ db }).assume("conv-ana", { id: "emp-marina", name: "Marina" });
  });

  it("delivers the employee's message to the analyst", async () => {
    const response = await send("conv-ana", { text: "  Ainda está lento  " });
    expect(response.status).toBe(201);
    const outside = await services.conversations!.listOutsideAgent("conv-ana");
    expect(outside.at(-1)).toMatchObject({ role: "employee", content: "Ainda está lento" });
  });

  it("refuses without a session, an empty text or someone else's conversation", async () => {
    expect((await send("conv-ana", { text: "" })).status).toBe(400);
    session.employeeId = "emp-bruno";
    expect((await send("conv-ana", { text: "oi" })).status).toBe(404);
    session.employeeId = null;
    expect((await send("conv-ana", { text: "oi" })).status).toBe(401);
  });

  it("tells the chat when the conversation is back with the agent", async () => {
    await services.conversations!.getOrCreate("emp-ana", "conv-new");
    const response = await send("conv-new", { text: "oi" });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "not_with_service_desk", status: "with_agent" },
    });
  });
});
