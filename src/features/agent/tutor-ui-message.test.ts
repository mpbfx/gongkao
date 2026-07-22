import { describe, expect, it } from "vitest";

import {
  prepareTutorRequest,
  tutorReviewDataSchema,
  type TutorUIMessage,
} from "@/features/agent/tutor-ui-message";

function message(id: string, role: "user" | "assistant", text: string): TutorUIMessage {
  return { id, role, parts: [{ type: "text", text }] };
}

describe("prepareTutorRequest", () => {
  it("only sends the trusted session identifier and last user prompt", () => {
    expect(
      prepareTutorRequest({
        messages: [message("u1", "user", "第一次"), message("a1", "assistant", "回答"), message("u2", "user", "  追问  ")],
        operation: "submit",
        sessionId: "session-1",
        mode: "knowledge",
      })
    ).toEqual({ sessionId: "session-1", prompt: "追问", operation: "submit", mode: "knowledge" });
  });

  it("uses the existing last user message for regenerate without duplicating it", () => {
    const messages = [message("u1", "user", "请重新解释"), message("a1", "assistant", "旧回答")];

    expect(prepareTutorRequest({ messages, operation: "regenerate", mode: "chat" })).toEqual({
      prompt: "请重新解释",
      operation: "regenerate",
      mode: "chat",
    });
    expect(messages).toHaveLength(2);
  });
});

describe("tutorReviewDataSchema", () => {
  it("validates the persisted structured review part", () => {
    expect(
      tutorReviewDataSchema.parse({
        mistakeCause: "OPTION_TRAP",
        confidence: "HIGH",
        causeSummary: "误选了局部正确项。",
        fastestPath: "检查所有限定词。",
        transferRule: "逐项验证完整条件。",
      })
    ).toMatchObject({ mistakeCause: "OPTION_TRAP", confidence: "HIGH" });
  });
});
