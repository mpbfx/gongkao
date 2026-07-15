import { describe, expect, it } from "vitest";

import {
  createTutorStreamState,
  tutorEventToUIMessageChunks,
} from "@/server/agent/tutor/ui-message-stream";

const review = {
  type: "review" as const,
  mistakeCause: "OPTION_TRAP" as const,
  confidence: "MEDIUM" as const,
  causeSummary: "被局部正确的选项干扰。",
  fastestPath: "逐项核对全部限定条件。",
  transferRule: "局部正确不等于完全符合题意。",
};

describe("tutorEventToUIMessageChunks", () => {
  it("maps activity, review, text, metadata and finish in UI message protocol order", () => {
    const state = createTutorStreamState();
    const chunks = [
      ...tutorEventToUIMessageChunks({ type: "status", phase: "thinking", label: "正在理解" }, state),
      ...tutorEventToUIMessageChunks(review, state),
      ...tutorEventToUIMessageChunks({ type: "token", content: "先看" }, state),
      ...tutorEventToUIMessageChunks({ type: "token", content: "限定条件。" }, state),
      ...tutorEventToUIMessageChunks(
        {
          type: "done",
          messageId: "persisted-1",
          suggestedPrompts: ["如何识别干扰项？"],
          runtime: "pi",
          durationMs: 120,
        },
        state
      ),
    ];

    expect(chunks.map((chunk) => chunk.type)).toEqual([
      "data-activity",
      "data-review",
      "text-start",
      "text-delta",
      "text-delta",
      "text-end",
      "data-suggestions",
      "message-metadata",
      "finish",
    ]);
    expect(chunks[0]).toMatchObject({ transient: true });
    expect(chunks[1]).toMatchObject({ id: "review", data: { mistakeCause: "OPTION_TRAP" } });
    expect(chunks[7]).toMatchObject({
      messageMetadata: { persistedMessageId: "persisted-1", runtime: "pi", durationMs: 120 },
    });
  });

  it("finishes a valid response even when Pi produced no text token", () => {
    const state = createTutorStreamState();
    const chunks = [
      ...tutorEventToUIMessageChunks(review, state),
      ...tutorEventToUIMessageChunks(
        {
          type: "done",
          messageId: "persisted-1",
          suggestedPrompts: [],
          runtime: "pi",
          durationMs: 1,
        },
        state
      ),
    ];

    expect(chunks.map((chunk) => chunk.type)).toEqual([
      "data-review",
      "data-suggestions",
      "message-metadata",
      "finish",
    ]);
  });

  it.each([
    [{ type: "degraded", reason: "模型不可用" } as const, "模型不可用"],
    [{ type: "error", message: "超过限制" } as const, "超过限制"],
  ])("maps %s to an AI SDK error finish", (event, message) => {
    const state = createTutorStreamState();
    tutorEventToUIMessageChunks({ type: "token", content: "部分" }, state);
    const chunks = tutorEventToUIMessageChunks(event, state);

    expect(chunks.map((chunk) => chunk.type)).toEqual(["text-end", "error", "finish"]);
    expect(chunks[1]).toEqual({ type: "error", errorText: message });
    expect(chunks[2]).toEqual({ type: "finish", finishReason: "error" });
  });
});
