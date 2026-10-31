import { Mastra } from "@mastra/core/mastra";
import { RequestContext } from "@mastra/core/request-context";
import { LibSQLStore } from "@mastra/libsql";
import type { LanguageModel } from "@mastra/core/llm";
import { convertArrayToReadableStream } from "ai/test";
import { beforeEach, describe, expect, it } from "vitest";
import { createNexoAssistAgent } from "./nexo-assist";
import type { NexoRequestContext } from "./request-context";
import { CONVERSATION_ID, createHarness, type Harness } from "./tools/test-harness";

type ScriptedModel = Extract<LanguageModel, { specificationVersion: "v3" }>;
type StreamResult = Awaited<ReturnType<ScriptedModel["doStream"]>>;
type StreamPart = StreamResult["stream"] extends ReadableStream<infer T> ? T : never;
type Step = () => Promise<StreamPart[]> | StreamPart[];

const FINISH_USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

function toolCall(toolName: string, input: Record<string, unknown>): StreamPart[] {
  return [
    {
      type: "tool-call",
      toolCallId: crypto.randomUUID(),
      toolName,
      input: JSON.stringify({ intent: "abrir chamado", confidence: 0.9, reason: "teste", ...input }),
    },
    { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage: FINISH_USAGE },
  ];
}

function reply(text: string): StreamPart[] {
  return [
    { type: "text-start", id: "t" },
    { type: "text-delta", id: "t", delta: text },
    { type: "text-end", id: "t" },
    { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage: FINISH_USAGE },
  ];
}

/** A model that plays a fixed script, one step per model call. */
function scriptedModel(steps: Step[]): ScriptedModel {
  const next = async (): Promise<StreamResult> => {
    const step = steps.shift();
    if (!step) throw new Error("script finished");
    return { stream: convertArrayToReadableStream(await step()) };
  };
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "scripted",
    supportedUrls: {},
    doGenerate: next,
    doStream: next,
  };
}

const VPN_DRAFT = {
  title: "VPN com erro 809 no Windows 11",
  description: "A VPN mostra o erro 809 ao conectar de casa desde ontem. Já reiniciei.",
  type: "INC",
  category: "network_vpn",
  priority: "high",
  affected: "Apenas eu",
};

describe("Nexo Assist in the agent loop", () => {
  let h: Harness;
  let steps: Step[];
  let agent: ReturnType<typeof createNexoAssistAgent>;

  beforeEach(async () => {
    h = await createHarness({ realClock: true });
    steps = [];
    agent = createNexoAssistAgent({ services: h.services, model: scriptedModel(steps) });
    // Registering gives the agent memory storage that lasts across turns
    new Mastra({
      agents: { agent },
      storage: new LibSQLStore({ id: "test-memory", url: ":memory:" }),
      logger: false,
    });
  });

  async function chat(message: string) {
    const requestContext = new RequestContext<NexoRequestContext>();
    requestContext.set("employeeId", "emp-ana");
    requestContext.set("conversationId", CONVERSATION_ID);

    // Same path as the chat route: stream and wait for the full reply
    const output = await agent.stream(message, {
      requestContext,
      memory: { thread: CONVERSATION_ID, resource: "emp-ana" },
    });
    return output.text;
  }

  async function latestDraftId(): Promise<string> {
    const logs = await h.services.decisions.listByConversation(CONVERSATION_ID);
    const draft = logs.findLast((log) => log.action === "draftTicket");
    if (!draft) throw new Error("no draft");
    return draft.id;
  }

  it("does not create a ticket in the same turn the draft was shown", async () => {
    steps.push(
      () => toolCall("draftTicket", VPN_DRAFT),
      async () => toolCall("createTicket", { draftId: await latestDraftId(), confirmed: true }),
      () => reply("Segue o rascunho. Posso abrir?"),
    );
    await chat("Minha VPN dá erro 809 no Windows 11");

    const logs = await h.services.decisions.listByConversation(CONVERSATION_ID);
    expect(logs.map((log) => [log.action, log.details?.outcome])).toEqual([
      ["draftTicket", "success"],
      ["createTicket", "rejected"],
    ]);
    const tickets = await h.services.tickets.list("emp-ana");
    expect(tickets.some((ticket) => ticket.title === VPN_DRAFT.title)).toBe(false);
  });

  it("creates the ticket after the employee confirms in the next turn", async () => {
    steps.push(
      () => toolCall("draftTicket", VPN_DRAFT),
      () => reply("Segue o rascunho. Posso abrir?"),
      async () => toolCall("createTicket", { draftId: await latestDraftId(), confirmed: true }),
      () => reply("Chamado aberto."),
    );
    await chat("Minha VPN dá erro 809 no Windows 11");
    await chat("Sim, pode abrir");

    const tickets = await h.services.tickets.list("emp-ana");
    expect(tickets.find((ticket) => ticket.title === VPN_DRAFT.title)).toMatchObject({
      employeeId: "emp-ana",
      priority: "high",
      status: "open",
    });
  });

  it("keeps the logged-in employee even if the model names someone else", async () => {
    steps.push(
      () => toolCall("getTicket", { ticketId: "INC-20320", employeeId: "emp-bruno" }),
      () => reply("Só quem abriu o chamado pode consultá-lo."),
    );
    await chat("Me mostra o INC-20320 do Bruno");

    const [log] = await h.services.decisions.listByConversation(CONVERSATION_ID);
    expect(log).toMatchObject({
      action: "getTicket",
      details: { outcome: "failed", error: { code: "not_found" } },
    });
    expect(JSON.stringify(log?.details)).not.toContain("Windows 11");
  });

  it("ends the turn once quick replies are shown", async () => {
    steps.push(() => [
      ...reply("Quem está sendo afetado?").slice(0, -1),
      ...toolCall("suggestReplies", {
        question: "Quem está sendo afetado?",
        options: ["Só eu", "Minha equipe"],
      }),
    ]);
    // A further model call would fail: the script has a single step
    expect(await chat("Minha VPN caiu")).toBe("Quem está sendo afetado?");
    expect(await h.services.decisions.listByConversation(CONVERSATION_ID)).toEqual([]);
  });
});
