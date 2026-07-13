import { describe, expect, it } from "vitest";

import {
  buildAccuracyTrend,
  buildKnowledgeWeeks,
  buildWeeklyKnowledgeHeatmap,
  startOfShanghaiWeekUtc,
} from "@/server/services/learning-situation";

describe("learning situation time buckets", () => {
  it("starts Shanghai weeks on Monday midnight", () => {
    expect(startOfShanghaiWeekUtc(new Date("2026-07-13T03:30:00.000Z")).toISOString()).toBe(
      "2026-07-12T16:00:00.000Z"
    );
    expect(startOfShanghaiWeekUtc(new Date("2026-07-12T15:59:59.000Z")).toISOString()).toBe(
      "2026-07-05T16:00:00.000Z"
    );
  });

  it("builds eight continuous calendar weeks including empty weeks", () => {
    const weeks = buildKnowledgeWeeks(new Date("2026-07-13T03:30:00.000Z"));

    expect(weeks).toHaveLength(8);
    expect(weeks.map((week) => week.key)).toEqual([
      "2026-05-25",
      "2026-06-01",
      "2026-06-08",
      "2026-06-15",
      "2026-06-22",
      "2026-06-29",
      "2026-07-06",
      "2026-07-13",
    ]);
  });
});

describe("weekly knowledge heatmap", () => {
  it("distinguishes zero accuracy from no data and marks limited samples", () => {
    const now = new Date("2026-07-13T03:30:00.000Z");
    const heatmap = buildWeeklyKnowledgeHeatmap([
      {
        isCorrect: false,
        submittedAt: new Date("2026-07-13T04:00:00.000Z"),
        tagId: "tag-a",
        tagName: "言语理解",
      },
      {
        isCorrect: true,
        submittedAt: new Date("2026-07-07T04:00:00.000Z"),
        tagId: null,
        tagName: "未分类",
      },
    ], now);

    const zeroCell = heatmap.cells.find(
      (cell) => cell.tagId === "tag-a" && cell.weekKey === "2026-07-13"
    );
    const emptyCell = heatmap.cells.find(
      (cell) => cell.tagId === "tag-a" && cell.weekKey === "2026-07-06"
    );

    expect(zeroCell).toMatchObject({ accuracy: 0, answeredCount: 1, sampleStatus: "limited" });
    expect(emptyCell).toMatchObject({ accuracy: null, answeredCount: 0, sampleStatus: "none" });
    expect(heatmap.tags.map((tag) => tag.name)).toContain("未分类");
  });

  it("sorts knowledge tags by real answer volume", () => {
    const now = new Date("2026-07-13T03:30:00.000Z");
    const answers = [
      ...Array.from({ length: 3 }, () => ({
        isCorrect: true,
        submittedAt: new Date("2026-07-13T04:00:00.000Z"),
        tagId: "tag-b",
        tagName: "判断推理",
      })),
      {
        isCorrect: false,
        submittedAt: new Date("2026-07-13T04:00:00.000Z"),
        tagId: "tag-a",
        tagName: "常识判断",
      },
    ];

    expect(buildWeeklyKnowledgeHeatmap(answers, now).tags.map((tag) => tag.id)).toEqual([
      "tag-b",
      "tag-a",
    ]);
  });
});

describe("accuracy trend", () => {
  it("orders submitted records chronologically and preserves genuine zero accuracy", () => {
    const result = buildAccuracyTrend([
      {
        id: "new",
        title: "后一次",
        mode: "SPECIAL",
        submittedAt: "2026-07-13T04:00:00.000Z",
        accuracy: "75.00",
        answeredCount: 3,
        totalCount: 4,
      },
      {
        id: "old",
        title: "前一次",
        mode: "PAPER",
        submittedAt: "2026-07-06T04:00:00.000Z",
        accuracy: "0.00",
        answeredCount: 1,
        totalCount: 10,
      },
    ]);

    expect(result.map((item) => item.id)).toEqual(["old", "new"]);
    expect(result[0]).toMatchObject({ accuracy: 0, modeLabel: "真题" });
  });
});
