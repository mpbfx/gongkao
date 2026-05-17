import { describe, expect, it } from "vitest";

import { buildDraftRecommendations, rankTagMetrics, type TagMetric } from "@/server/agent/coach/recommendation-engine";
import type { CoachConfig } from "@/server/agent/shared/schemas";

const config: CoachConfig = {
  recentSessionLimit: 20,
  recentDays: 7,
  minAnswersPerTag: 5,
  maxRecommendations: 3,
  slowTimeMultiplier: 1.3,
};

describe("coach recommendation engine", () => {
  it("falls back to daily practice when there is not enough tag data", () => {
    const recommendations = buildDraftRecommendations({
      metrics: [
        {
          tagId: "tag-a",
          tagName: "数量关系",
          answeredCount: 2,
          correctCount: 1,
          wrongCount: 1,
          totalTimeSeconds: 80,
          unresolvedWrongCount: 0,
        },
      ],
      config,
      overallAverageTimeSeconds: 40,
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].action.type).toBe("DAILY_PRACTICE");
    expect(recommendations[0].confidence).toBe("LOW");
  });

  it("prioritizes tags with low accuracy and unresolved wrong questions", () => {
    const metrics: TagMetric[] = [
      {
        tagId: "tag-a",
        tagName: "资料分析",
        answeredCount: 20,
        correctCount: 10,
        wrongCount: 10,
        totalTimeSeconds: 1800,
        unresolvedWrongCount: 8,
      },
      {
        tagId: "tag-b",
        tagName: "言语理解",
        answeredCount: 20,
        correctCount: 16,
        wrongCount: 4,
        totalTimeSeconds: 600,
        unresolvedWrongCount: 0,
      },
    ];

    const ranked = rankTagMetrics(metrics, config, 60);
    const recommendations = buildDraftRecommendations({
      metrics,
      config,
      overallAverageTimeSeconds: 60,
    });

    expect(ranked[0].metric.tagName).toBe("资料分析");
    expect(recommendations[0].action.type).toBe("WRONG_PRACTICE");
    expect(recommendations[0].confidence).toBe("HIGH");
  });

  it("recommends special practice when weak tag has no enough unresolved wrong questions", () => {
    const recommendations = buildDraftRecommendations({
      metrics: [
        {
          tagId: "tag-a",
          tagName: "判断推理",
          answeredCount: 10,
          correctCount: 4,
          wrongCount: 6,
          totalTimeSeconds: 700,
          unresolvedWrongCount: 1,
        },
      ],
      config,
      overallAverageTimeSeconds: 60,
    });

    expect(recommendations[0].action.type).toBe("SPECIAL_PRACTICE");
    expect(recommendations[0].action).toMatchObject({
      tagId: "tag-a",
      count: 10,
    });
  });
});

