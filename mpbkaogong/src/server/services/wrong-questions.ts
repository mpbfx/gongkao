import { z } from "zod";

import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { BusinessError, NotFoundError } from "@/server/services/errors";
import { emptyStringToUndefined } from "@/server/services/pagination";
import { createQuestionPracticeSession } from "@/server/services/practice";
import { toQuestionDto } from "@/server/services/questions";

const booleanStringSchema = z
  .preprocess(emptyStringToUndefined, z.union([z.literal("true"), z.literal("false"), z.boolean()]).optional())
  .transform((value) => value === true || value === "true");

export const wrongQuestionsQuerySchema = z.object({
  tagId: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  includeResolved: booleanStringSchema,
});

export const createWrongSessionSchema = z.object({
  mode: z.enum(["WRONG", "MEMORIZE"]).default("WRONG"),
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
    ...(query.includeResolved ? {} : { resolvedAt: null }),
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
        question: ReturnType<typeof toQuestionDto>;
      }>;
    }
  >();

  for (const wrongQuestion of wrongQuestions) {
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
    mode: input.mode,
    title: input.mode === "MEMORIZE" ? `背题模式：${tagName}` : `错题练习：${tagName}`,
    questions: selectedWrongQuestions.map((wrongQuestion) => wrongQuestion.question),
    sourceTagIdsJson: input.tagId ? [{ tagId: input.tagId, num: requestedCount }] : undefined,
  });
}

export async function resolveWrongQuestion(user: AuthenticatedUser, id: string) {
  const wrongQuestion = await prisma.wrongQuestion.findFirst({
    where: {
      id,
      userId: user.id,
    },
    select: {
      id: true,
      resolvedAt: true,
    },
  });

  if (!wrongQuestion) {
    throw new NotFoundError("错题不存在");
  }

  if (wrongQuestion.resolvedAt) {
    return {
      id: wrongQuestion.id,
      resolvedAt: wrongQuestion.resolvedAt.toISOString(),
    };
  }

  const resolved = await prisma.wrongQuestion.update({
    where: { id: wrongQuestion.id },
    data: { resolvedAt: new Date() },
    select: {
      id: true,
      resolvedAt: true,
    },
  });

  return {
    id: resolved.id,
    resolvedAt: resolved.resolvedAt?.toISOString() ?? null,
  };
}
