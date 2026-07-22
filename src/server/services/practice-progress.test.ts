import { describe, expect, it } from "vitest";

import { normalizePracticeProgressAnswers } from "@/server/services/practice-progress";

describe("normalizePracticeProgressAnswers", () => {
  it("normalizes partial answer progress without grading it", () => {
    expect(
      normalizePracticeProgressAnswers([
        {
          questionId: "question-1",
          answer: " B ",
          timeSpentSeconds: 12,
          decisionNote: "  排除 A  ",
        },
        { questionId: "question-2", answer: "  ", timeSpentSeconds: 4 },
      ])
    ).toEqual([
      {
        questionId: "question-1",
        answer: "B",
        timeSpentSeconds: 12,
        decisionNote: "排除 A",
      },
      {
        questionId: "question-2",
        answer: null,
        timeSpentSeconds: 4,
        decisionNote: null,
      },
    ]);
  });
});
