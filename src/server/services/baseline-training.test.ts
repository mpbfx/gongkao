import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    practiceSession: { findFirst },
  },
}));

import { getBaselineTrainingState } from "@/server/services/baseline-training";

describe("baseline training state", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("uses the first submitted baseline and keeps an unfinished session resumable", async () => {
    findFirst
      .mockResolvedValueOnce({
        id: "baseline-first",
        paperId: "paper-1",
        title: "第一次基准测试",
        score: "70.00",
        maxScore: "100.00",
        accuracy: "70.00",
        elapsedSeconds: 6000,
        submittedAt: new Date("2026-07-01T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({ id: "baseline-running", paperId: "paper-2", title: "未完成基准测试" });

    const state = await getBaselineTrainingState({ id: "user-1" } as never);

    expect(state.submitted).toMatchObject({
      id: "baseline-first",
      score: "70.00",
      submittedAt: "2026-07-01T00:00:00.000Z",
    });
    expect(state.inProgress?.id).toBe("baseline-running");
    expect(findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { userId: "user-1", purpose: "BASELINE", status: "SUBMITTED" },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
    }));
  });

  it("returns an empty state without requiring an exam goal", async () => {
    findFirst.mockResolvedValue(null);

    await expect(getBaselineTrainingState({ id: "user-1" } as never)).resolves.toEqual({
      submitted: null,
      inProgress: null,
    });
  });
});
