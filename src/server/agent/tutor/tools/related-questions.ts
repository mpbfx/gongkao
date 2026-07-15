import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import { z } from "zod";

import type { QuestionType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import type { TutorQuestionContext } from "@/server/agent/tutor/context/question-context";
import { stripHtml, truncateText } from "@/server/agent/shared/text";
import { throwIfAborted, toolText } from "@/server/agent/tutor/tools/tool-utils";

const parameters = Type.Object({ limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 3 })) });
const inputSchema = z.object({ limit: z.number().int().min(1).max(3).default(2) });

export function createRelatedQuestionsTool(context: TutorQuestionContext): AgentTool<typeof parameters> {
  return {
    name: "search_related_questions",
    label: "检索同类题",
    description: "按当前题目的知识点、题型和难度检索少量同类题。仅在用户询问迁移、同类题或知识点规律时调用。",
    parameters,
    execute: async (_toolCallId, raw, signal) => {
      throwIfAborted(signal);
      const input = inputSchema.parse(raw);

      if (!context.tagId) {
        return { content: [{ type: "text", text: "当前题没有知识点标签，无法检索同类题。" }], details: { count: 0 } };
      }

      const questions = await prisma.question.findMany({
        where: {
          id: { not: context.questionId },
          tagId: context.tagId,
          type: context.questionType as QuestionType,
          isActive: true,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: { id: true, titleHtml: true, correctAnswer: true, analysisHtml: true, difficulty: true },
      });
      const result = questions.map((question) => ({
        id: question.id,
        title: truncateText(stripHtml(question.titleHtml), 500),
        correctAnswer: question.correctAnswer,
        analysis: truncateText(stripHtml(question.analysisHtml), 600),
        difficulty: question.difficulty,
      }));

      return {
        content: [{ type: "text", text: toolText(result) }],
        details: { count: result.length },
      };
    },
  };
}
