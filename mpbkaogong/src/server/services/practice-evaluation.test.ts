import { describe, expect, it } from "vitest";

import {
  evaluateFoundationRound,
  evaluatePracticeAnswers,
} from "@/server/services/practice-evaluation";

describe("practice evaluation", () => {
  it("calculates weighted paper score and section totals", () => {
    const result = evaluatePracticeAnswers(
      [
        { questionId: "q1", correctAnswer: "A", score: 2, sectionName: "言语" },
        { questionId: "q2", correctAnswer: "B", score: null, sectionName: "言语" },
        { questionId: "q3", correctAnswer: "C", score: 3, sectionName: "判断" },
      ],
      [
        { questionId: "q1", answer: "A", timeSpentSeconds: 10 },
        { questionId: "q2", answer: "A", timeSpentSeconds: 20 },
      ]
    );

    expect(result).toMatchObject({
      totalCount: 3,
      answeredCount: 2,
      correctCount: 1,
      wrongCount: 1,
      unansweredCount: 1,
      score: 2,
      maxScore: 6,
    });
    expect(result.sections[0]).toMatchObject({ name: "言语", score: 2, maxScore: 3 });
  });

  it("passes a foundation round at nine correct answers", () => {
    expect(evaluateFoundationRound({ totalCount: 15, correctCount: 8 }).passed).toBe(false);
    expect(evaluateFoundationRound({ totalCount: 15, correctCount: 9 }).passed).toBe(true);
  });
});
