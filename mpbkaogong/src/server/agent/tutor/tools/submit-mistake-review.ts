import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";

import type { TutorQuestionContext } from "@/server/agent/tutor/context/question-context";
import {
  tutorMistakeReviewSchema,
  type TutorMistakeReview,
} from "@/server/agent/tutor/schemas/tutor-schemas";
import { throwIfAborted } from "@/server/agent/tutor/tools/tool-utils";

const parameters = Type.Object({
  mistakeCause: Type.Union([
    Type.Literal("READING_MISS"),
    Type.Literal("CONCEPT_GAP"),
    Type.Literal("METHOD_GAP"),
    Type.Literal("OPTION_TRAP"),
    Type.Literal("CALCULATION_ERROR"),
    Type.Literal("MATERIAL_LOCATION_ERROR"),
    Type.Literal("LOGIC_CHAIN_BREAK"),
    Type.Literal("TIME_STRATEGY_ERROR"),
    Type.Literal("CARELESSNESS"),
    Type.Literal("UNKNOWN"),
  ]),
  confidence: Type.Union([Type.Literal("LOW"), Type.Literal("MEDIUM"), Type.Literal("HIGH")]),
  causeSummary: Type.String({ minLength: 1, maxLength: 800 }),
  fastestPath: Type.String({ minLength: 1, maxLength: 1_500 }),
  transferRule: Type.String({ minLength: 1, maxLength: 800 }),
  suggestedPrompts: Type.Array(Type.String({ minLength: 1, maxLength: 100 }), { minItems: 1, maxItems: 3 }),
});

export type ReviewSubmission = { value?: TutorMistakeReview };

export function createSubmitMistakeReviewTool(
  context: TutorQuestionContext,
  submission: ReviewSubmission
): AgentTool<typeof parameters> {
  return {
    name: "submit_mistake_review",
    label: "提交本题复盘",
    description: "在给出最终回答前提交本次结构化 Mistake Review。每次运行必须且只能成功调用一次。",
    parameters,
    executionMode: "sequential",
    execute: async (_toolCallId, raw, signal) => {
      throwIfAborted(signal);

      if (submission.value) {
        throw new Error("Mistake Review 已提交，本次运行不能重复提交。");
      }

      const parsed = tutorMistakeReviewSchema.parse(raw);
      submission.value =
        parsed.mistakeCause === "TIME_STRATEGY_ERROR" && !context.timeSpentSeconds
          ? {
              ...parsed,
              mistakeCause: "UNKNOWN",
              confidence: "LOW",
              causeSummary: "本题缺少可靠作答用时，不能判断为时间策略问题。",
            }
          : parsed;

      return {
        content: [{ type: "text", text: "Mistake Review 已通过校验。现在请直接回答用户，不要复述工具参数。" }],
        details: { submitted: true },
      };
    },
  };
}
