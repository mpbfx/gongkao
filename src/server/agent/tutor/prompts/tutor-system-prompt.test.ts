import { describe, expect, it } from "vitest";

import type { TutorQuestionContext } from "@/server/agent/tutor/context/question-context";
import { buildTutorSystemPrompt } from "@/server/agent/tutor/prompts/tutor-system-prompt";

describe("Tutor system prompt", () => {
  it("requires adaptive answers, real history use, and one structured review submission", () => {
    const prompt = buildTutorSystemPrompt({
      questionId: "q1",
      practiceAnswerId: null,
      title: "题干",
      material: "",
      options: [],
      correctAnswer: "A",
      analysis: "解析",
      userAnswer: "B",
      tagId: null,
      tagName: null,
      questionType: "SINGLE",
      difficulty: "UNKNOWN",
      source: null,
      wrongCount: 1,
      timeSpentSeconds: null,
      sessionAverageTimeSeconds: null,
      userAverageTimeSeconds: null,
      tagAverageTimeSeconds: null,
      hasOfficialAnalysis: true,
      hasImageContent: false,
    } satisfies TutorQuestionContext);

    expect(prompt).toContain("不要每次套用同一标题结构");
    expect(prompt).toContain("数据库历史消息已经进入会话");
    expect(prompt).toContain("必须且只能成功调用一次 submit_mistake_review");
    expect(prompt).toContain("行内公式用 $...$");
  });
});
