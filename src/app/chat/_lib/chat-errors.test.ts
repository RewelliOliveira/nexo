import { describe, expect, it } from "vitest";
import { describeChatError } from "./chat-errors";

const apiError = (code: string, message: string) =>
  new Error(JSON.stringify({ error: { code, message } }));

describe("chat errors", () => {
  it("leaves refusals the conversation status already explains", () => {
    expect(describeChatError(apiError("agent_paused", "transferida"))).toEqual({
      kind: "explained",
    });
    expect(describeChatError(apiError("message_limit", "limite"))).toEqual({ kind: "explained" });
  });

  it("asks to sign in again when the session is gone", () => {
    expect(describeChatError(apiError("unauthenticated", "Entre de novo."))).toEqual({
      kind: "signed_out",
      message: "Entre de novo.",
    });
  });

  it("shows the message the route wrote for the employee", () => {
    expect(
      describeChatError(new Error("Não consegui responder agora. Tente novamente em instantes.")),
    ).toMatchObject({ kind: "retry", message: expect.stringContaining("Não consegui") });
  });

  it("explains a lost connection", () => {
    expect(describeChatError(new TypeError("Failed to fetch"))).toMatchObject({
      kind: "retry",
      title: "Sem conexão com o Nexo Assist",
    });
  });

  it("never shows raw technical output", () => {
    const failure = describeChatError(new Error('{"unexpected": true}'));
    expect(failure).toMatchObject({ kind: "retry" });
    expect(JSON.stringify(failure)).not.toContain("unexpected");
  });
});
