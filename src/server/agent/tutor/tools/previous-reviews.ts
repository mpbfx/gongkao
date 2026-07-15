import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import type { TutorQuestionContext } from "@/server/agent/tutor/context/question-context";
import { throwIfAborted, toolText } from "@/server/agent/tutor/tools/tool-utils";

const parameters = Type.Object({
  scope: Type.Union([Type.Literal("question"), Type.Literal("knowledge_point")]),
});
const inputSchema = z.object({ scope: z.enum(["question", "knowledge_point"]) });

export function previousReviewScope(
  userId: string,
  context: TutorQuestionContext,
  scope: "question" | "knowledge_point"
) {
  const useTag = scope === "knowledge_point" && context.tagId;
  return { userId, ...(useTag ? { tagId: context.tagId } : { questionId: context.questionId }) };
}

export function createPreviousReviewsTool(userId: string, context: TutorQuestionContext): AgentTool<typeof parameters> {
  return {
    name: "get_previous_reviews",
    label: "读取历史错因复盘",
    description: "查询当前用户对本题或同知识点题目的历史 Mistake Review，用于理解多次犯错和迁移模式。",
    parameters,
    execute: async (_toolCallId, raw, signal) => {
      throwIfAborted(signal);
      const input = inputSchema.parse(raw);
      const reviews = await prisma.questionMistakeReview.findMany({
        where: previousReviewScope(userId, context, input.scope),
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          questionId: true,
          mistakeCause: true,
          confidence: true,
          causeSummary: true,
          fastestPath: true,
          transferRule: true,
          createdAt: true,
        },
      });

      return {
        content: [{ type: "text", text: toolText(reviews) }],
        details: { count: reviews.length, scope: input.scope },
      };
    },
  };
}
