import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    agentTutorMessage: { findMany },
  },
}));

import { getTutorHistory } from "@/server/agent/tutor/persistence/messages";

describe("getTutorHistory", () => {
  beforeEach(() => findMany.mockReset());

  it("returns UI messages with a persistent review part and metadata", async () => {
    findMany.mockResolvedValue([
      {
        id: "assistant-1",
        role: "ASSISTANT",
        content: "完整讲解",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        metadataJson: {
          status: "completed",
          runtime: "pi",
          durationMs: 80,
          mistakeCause: "OPTION_TRAP",
          confidence: "MEDIUM",
          causeSummary: "被干扰项吸引。",
          fastestPath: "核对限定条件。",
          transferRule: "验证完整条件。",
          suggestedPrompts: ["还有更快的方法吗？"],
        },
      },
      {
        id: "user-1",
        role: "USER",
        content: "为什么不选 B？",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        metadataJson: { status: "completed", runtime: "pi" },
      },
    ]);

    const result = await getTutorHistory("user-1", "question-1");

    expect(result.messages).toHaveLength(2);
    expect(result.messages[1]).toMatchObject({
      id: "assistant-1",
      role: "assistant",
      metadata: { persistedMessageId: "assistant-1", runtime: "pi", durationMs: 80 },
      parts: [
        { type: "data-review", data: { mistakeCause: "OPTION_TRAP" } },
        { type: "text", text: "完整讲解" },
      ],
    });
    expect(result.suggestedPrompts).toEqual(["还有更快的方法吗？"]);
  });

  it("excludes cancelled and failed turns from trusted history", async () => {
    findMany.mockResolvedValue([
      {
        id: "failed-user",
        role: "USER",
        content: "失败问题",
        createdAt: new Date(),
        metadataJson: { status: "failed", runtime: "pi" },
      },
    ]);

    await expect(getTutorHistory("user-1", "question-1")).resolves.toMatchObject({ messages: [] });
  });
});
