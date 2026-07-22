import { describe, expect, it } from "vitest";

import {
  getPreviouslyGradedQuestionIds,
  normalizePracticeProgressAnswers,
} from "@/server/services/practice-progress";

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

describe("getPreviouslyGradedQuestionIds", () => {
  it("reads the answers already counted before a submitted session was reopened", () => {
    expect(
      Array.from(
        getPreviouslyGradedQuestionIds({
          reopenedSubmission: {
            gradedQuestionIds: ["question-1", "question-2", 3],
          },
        })
      )
    ).toEqual(["question-1", "question-2"]);
  });
});
