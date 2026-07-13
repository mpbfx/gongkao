import { describe, expect, it } from "vitest";

import type { TutorQuestionContext } from "@/server/agent/tutor/context/question-context";
import { learnerReviewScope } from "@/server/agent/tutor/tools/learner-patterns";
import { previousReviewScope } from "@/server/agent/tutor/tools/previous-reviews";

const context = {
  questionId: "question-current",
  practiceAnswerId: null,
  title: "题干",
  material: "",
  options: [],
  correctAnswer: "A",
  analysis: "解析",
  userAnswer: "B",
  tagId: "tag-current",
  tagName: "资料分析",
  questionType: "SINGLE",
  difficulty: "MEDIUM",
  source: null,
  wrongCount: 1,
  timeSpentSeconds: 60,
  sessionAverageTimeSeconds: null,
  userAverageTimeSeconds: null,
  tagAverageTimeSeconds: null,
  hasOfficialAnalysis: true,
  hasImageContent: false,
} satisfies TutorQuestionContext;

describe("Tutor tool access scopes", () => {
  it("always binds review queries to the authenticated user and trusted context", () => {
    expect(learnerReviewScope("user-current", context)).toEqual({
      userId: "user-current",
      isLatestForQuestion: true,
      tagId: "tag-current",
    });
    expect(previousReviewScope("user-current", context, "question")).toEqual({
      userId: "user-current",
      questionId: "question-current",
    });
    expect(previousReviewScope("user-current", context, "knowledge_point")).toEqual({
      userId: "user-current",
      tagId: "tag-current",
    });
  });
});
