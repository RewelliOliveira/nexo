import { describe, expect, it } from "vitest";
import { MAX_TURN_STEPS, SUGGEST_REPLIES_TOOL_ID, turnFinished } from "./suggest-replies";

const step = (toolName: string) => ({ toolCalls: [{ toolName }] });

describe("turnFinished", () => {
  it("keeps going while the model is using its tools", () => {
    expect(turnFinished({ steps: [step("listMyTickets")] })).toBe(false);
  });

  it("ends the turn once quick replies are shown", () => {
    expect(
      turnFinished({ steps: [step("listMyTickets"), step(SUGGEST_REPLIES_TOOL_ID)] }),
    ).toBe(true);
  });

  it("stops a model that never stops calling tools", () => {
    const steps = Array.from({ length: MAX_TURN_STEPS }, () => step("listMyTickets"));
    expect(turnFinished({ steps: steps.slice(1) })).toBe(false);
    expect(turnFinished({ steps })).toBe(true);
  });
});
