import { describe, expect, it } from "vitest";

import type { TutorQuestionContext } from "@/server/agent/tutor/context/question-context";
import {
  createSubmitMistakeReviewTool,
  type ReviewSubmission,
} from "@/server/agent/tutor/tools/submit-mistake-review";

const context = {
  questionId: "question-1",
  practiceAnswerId: "answer-1",
  title: "题干",
  material: "",
  options: [],
  correctAnswer: "A",
  analysis: "解析",
  userAnswer: "B",
  tagId: "tag-1",
  tagName: "判断推理",
  questionType: "SINGLE",
  difficulty: "MEDIUM",
  source: null,
  wrongCount: 1,
  timeSpentSeconds: null,
  sessionAverageTimeSeconds: null,
  userAverageTimeSeconds: null,
  tagAverageTimeSeconds: null,
  hasOfficialAnalysis: true,
  hasImageContent: false,
} satisfies TutorQuestionContext;

const review = {
  mistakeCause: "TIME_STRATEGY_ERROR" as const,
  confidence: "HIGH" as const,
  causeSummary: "做题太慢",
  fastestPath: "先排除明显错误项",
  transferRule: "先看限定条件",
  suggestedPrompts: ["为什么不选 B？"],
};

describe("submit_mistake_review tool", () => {
  it("normalizes unsupported time diagnoses and stages one review", async () => {
    const submission: ReviewSubmission = {};
    const tool = createSubmitMistakeReviewTool(context, submission);

    await tool.execute("call-1", review);

    expect(submission.value).toMatchObject({ mistakeCause: "UNKNOWN", confidence: "LOW" });
    await expect(tool.execute("call-2", review)).rejects.toThrow("不能重复提交");
  });
});
