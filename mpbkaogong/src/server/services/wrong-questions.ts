import { z } from "zod";

import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { latestMistakeReviewMap, type LatestMistakeReviewSummary } from "@/server/agent/mistakes/service";
import { mistakeCauseSchema } from "@/server/agent/shared/schemas";
import { BusinessError, NotFoundError } from "@/server/services/errors";
import { emptyStringToUndefined } from "@/server/services/pagination";
import { createQuestionPracticeSession } from "@/server/services/practice";
import { toQuestionDto } from "@/server/services/questions";

const booleanStringSchema = z
  .preprocess(emptyStringToUndefined, z.union([z.literal("true"), z.literal("false"), z.boolean()]).optional())
  .transform((value) => value === true || value === "true");

export const wrongQuestionsQuerySchema = z.object({
  tagId: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  mistakeCause: z.preprocess(emptyStringToUndefined, mistakeCauseSchema.optional()),
  analysis: z.preprocess(emptyStringToUndefined, z.enum(["analyzed", "unanalyzed", "all"]).default("all")),
  includeResolved: booleanStringSchema,
});

export const createWrongSessionSchema = z.object({
  mode: z.literal("WRONG").default("WRONG"),
  tagId: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  count: z.preprocess(emptyStringToUndefined, z.coerce.number().int().min(1).max(100).optional()),
});

export type WrongQuestionsQuery = z.infer<typeof wrongQuestionsQuerySchema>;
export type CreateWrongSessionInput = z.infer<typeof createWrongSessionSchema>;

function shuffle<T>(items: T[]) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }

  return result;
}

export async function listWrongQuestions(user: AuthenticatedUser, query: WrongQuestionsQuery) {
  const where = {
    userId: user.id,
    resolvedAt: query.includeResolved ? { not: null } : null,
    ...(query.tagId ? { tagId: query.tagId } : {}),
  };

  const [wrongQuestions, unresolvedCount, resolvedCount] = await Promise.all([
    prisma.wrongQuestion.findMany({
      where,
      orderBy: [{ lastWrongAt: "desc" }, { createdAt: "desc" }],
      include: {
        tag: { select: { id: true, name: true } },
        question: {
          include: {
            material: { select: { id: true, title: true, contentHtml: true } },
            tag: { select: { id: true, name: true } },
            options: { orderBy: { sortOrder: "asc" } },
          },
        },
        lastAnswer: {
          select: {
            answer: true,
            sessionId: true,
            timeSpentSeconds: true,
          },
        },
      },
    }),
    prisma.wrongQuestion.count({
      where: {
        userId: user.id,
        resolvedAt: null,
      },
    }),
    prisma.wrongQuestion.count({
      where: {
        userId: user.id,
        resolvedAt: { not: null },
      },
    }),
  ]);

  const groups = new Map<
    string,
    {
      tagId: string | null;
      tagName: string;
      count: number;
      items: Array<{
        id: string;
        questionId: string;
        wrongCount: number;
        lastWrongAt: string;
        resolvedAt: string | null;
        latestMistakeReview: LatestMistakeReviewSummary | null;
        lastAnswer: {
          answer: string | null;
          sessionId: string;
          timeSpentSeconds: number;
        } | null;
        question: ReturnType<typeof toQuestionDto>;
      }>;
    }
  >();

  const latestReviewByQuestionId = await latestMistakeReviewMap(
    user,
    wrongQuestions.map((wrongQuestion) => wrongQuestion.questionId)
  );
  const filteredWrongQuestions = wrongQuestions.filter((wrongQuestion) => {
    const latestReview = latestReviewByQuestionId.get(wrongQuestion.questionId) ?? null;

    if (query.analysis === "analyzed" && !latestReview) {
      return false;
    }

    if (query.analysis === "unanalyzed" && latestReview) {
      return false;
    }

    if (query.mistakeCause && latestReview?.mistakeCause !== query.mistakeCause) {
      return false;
    }

    return true;
  });

  for (const wrongQuestion of filteredWrongQuestions) {
    const tagId = wrongQuestion.tag?.id ?? wrongQuestion.question.tag?.id ?? null;
    const tagName = wrongQuestion.tag?.name ?? wrongQuestion.question.tag?.name ?? "未分类";
    const groupKey = tagId ?? "untagged";
    const group =
      groups.get(groupKey) ??
      ({
        tagId,
        tagName,
        count: 0,
        items: [],
      } satisfies {
        tagId: string | null;
        tagName: string;
        count: number;
        items: Array<{
          id: string;
          questionId: string;
          wrongCount: number;
          lastWrongAt: string;
          resolvedAt: string | null;
          latestMistakeReview: LatestMistakeReviewSummary | null;
          lastAnswer: {
            answer: string | null;
            sessionId: string;
            timeSpentSeconds: number;
          } | null;
          question: ReturnType<typeof toQuestionDto>;
        }>;
      });

    group.count += 1;
    group.items.push({
      id: wrongQuestion.id,
      questionId: wrongQuestion.questionId,
      wrongCount: wrongQuestion.wrongCount,
      lastWrongAt: wrongQuestion.lastWrongAt.toISOString(),
      resolvedAt: wrongQuestion.resolvedAt?.toISOString() ?? null,
      latestMistakeReview: latestReviewByQuestionId.get(wrongQuestion.questionId) ?? null,
      lastAnswer: wrongQuestion.lastAnswer
        ? {
            answer: wrongQuestion.lastAnswer.answer,
            sessionId: wrongQuestion.lastAnswer.sessionId,
            timeSpentSeconds: wrongQuestion.lastAnswer.timeSpentSeconds,
          }
        : null,
      question: toQuestionDto(wrongQuestion.question, true),
    });
    groups.set(groupKey, group);
  }

  return {
    summary: {
      totalCount: unresolvedCount + resolvedCount,
      unresolvedCount,
      resolvedCount,
    },
    groups: Array.from(groups.values()).toSorted((first, second) => second.count - first.count),
  };
}

export async function createWrongQuestionPracticeSession(
  user: AuthenticatedUser,
  input: CreateWrongSessionInput
) {
  const wrongQuestions = await prisma.wrongQuestion.findMany({
    where: {
      userId: user.id,
      resolvedAt: null,
      ...(input.tagId ? { tagId: input.tagId } : {}),
    },
    orderBy: [{ lastWrongAt: "desc" }, { createdAt: "desc" }],
    include: {
      tag: { select: { id: true, name: true } },
      question: {
        include: {
          material: { select: { id: true, title: true, contentHtml: true } },
          tag: { select: { id: true, name: true } },
          options: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (wrongQuestions.length === 0) {
    throw new BusinessError("暂无可练习的错题");
  }

  const requestedCount = input.count ?? Math.min(10, wrongQuestions.length);

  if (wrongQuestions.length < requestedCount) {
    throw new BusinessError("当前错题数量不足，请减少题数或选择全部错题");
  }

  const selectedWrongQuestions = shuffle(wrongQuestions).slice(0, requestedCount);
  const tagName = input.tagId
    ? (selectedWrongQuestions[0]?.tag?.name ?? selectedWrongQuestions[0]?.question.tag?.name ?? "未分类")
    : "全部错题";

  return createQuestionPracticeSession({
    user,
    mode: "WRONG",
    title: `错题练习：${tagName}`,
    questions: selectedWrongQuestions.map((wrongQuestion) => wrongQuestion.question),
    sourceTagIdsJson: input.tagId ? [{ tagId: input.tagId, num: requestedCount }] : undefined,
  });
}

export async function restoreWrongQuestion(user: AuthenticatedUser, id: string) {
  const restored = await prisma.wrongQuestion.updateMany({
    where: { id, userId: user.id, resolvedAt: { not: null } },
    data: { resolvedAt: null },
  });

  if (restored.count === 0) {
    const exists = await prisma.wrongQuestion.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!exists) throw new NotFoundError("错题不存在");
  }

  return { id, resolvedAt: null };
}

export async function resolveWrongQuestion(user: AuthenticatedUser, id: string) {
  const resolved = await prisma.wrongQuestion.updateMany({
    where: { id, userId: user.id, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });

  if (resolved.count === 0) {
    const exists = await prisma.wrongQuestion.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!exists) throw new NotFoundError("错题不存在");
  }

  return { id };
}
