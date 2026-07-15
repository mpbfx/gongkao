import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";

import { prisma } from "@/lib/db/prisma";
import type { TutorQuestionContext } from "@/server/agent/tutor/context/question-context";
import { throwIfAborted, toolText } from "@/server/agent/tutor/tools/tool-utils";

export function learnerReviewScope(userId: string, context: TutorQuestionContext) {
  return {
    userId,
    isLatestForQuestion: true,
    ...(context.tagId ? { tagId: context.tagId } : { questionId: context.questionId }),
  };
}

export function createLearnerPatternsTool(userId: string, context: TutorQuestionContext): AgentTool {
  return {
    name: "get_learner_mistake_patterns",
    label: "读取个人错题模式",
    description: "查询当前用户在本题知识点下的练习统计和最近结构化错因分布。仅在需要个性化判断时调用。",
    parameters: Type.Object({}),
    execute: async (_toolCallId, _params, signal) => {
      throwIfAborted(signal);
      const [tagStats, reviews] = await Promise.all([
        context.tagId
          ? prisma.userTagStats.findUnique({
              where: { userId_tagId: { userId, tagId: context.tagId } },
              select: { answeredCount: true, correctCount: true, wrongCount: true, accuracy: true },
            })
          : null,
        prisma.questionMistakeReview.findMany({
          where: learnerReviewScope(userId, context),
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { mistakeCause: true },
        }),
      ]);
      const distribution = reviews.reduce<Record<string, number>>((counts, review) => {
        counts[review.mistakeCause] = (counts[review.mistakeCause] ?? 0) + 1;
        return counts;
      }, {});

      return {
        content: [{ type: "text", text: toolText({ tagName: context.tagName, tagStats, distribution }) }],
        details: { reviewCount: reviews.length },
      };
    },
  };
}
