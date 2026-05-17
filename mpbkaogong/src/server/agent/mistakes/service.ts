import type { MistakeCause } from "@/generated/prisma/enums";
import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { mistakeCauseLabels, mistakeCauseSchema } from "@/server/agent/shared/schemas";

export const insightRanges = ["30", "90", "all"] as const;
export type InsightRange = (typeof insightRanges)[number];

export type LatestMistakeReviewSummary = {
  id: string;
  mistakeCause: MistakeCause;
  mistakeCauseLabel: string;
  confidence: string;
  causeSummary: string;
  fastestPath: string;
  transferRule: string;
  createdAt: string;
};

export type MistakeReviewInput = {
  userId: string;
  questionId: string;
  sessionId?: string | null;
  practiceAnswerId?: string | null;
  tutorMessageId?: string | null;
  tagId?: string | null;
  mistakeCause: MistakeCause;
  confidence: string;
  causeSummary: string;
  fastestPath: string;
  transferRule: string;
  timeSpentSeconds?: number | null;
};

const causeOrder = mistakeCauseSchema.options;

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function rangeStart(range: InsightRange) {
  if (range === "all") {
    return null;
  }

  const days = Number(range);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  return start;
}

function eachDay(start: Date, end: Date) {
  const days: string[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  while (current <= end) {
    days.push(dateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export function movingAverage(values: number[], windowSize = 7) {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const window = values.slice(start, index + 1);
    const average = window.reduce((total, value) => total + value, 0) / window.length;

    return Number(average.toFixed(2));
  });
}

export function causeLabel(cause: MistakeCause) {
  return mistakeCauseLabels[cause];
}

export function toLatestMistakeReviewSummary(review: {
  id: string;
  mistakeCause: MistakeCause;
  confidence: string;
  causeSummary: string;
  fastestPath: string;
  transferRule: string;
  createdAt: Date;
}): LatestMistakeReviewSummary {
  return {
    id: review.id,
    mistakeCause: review.mistakeCause,
    mistakeCauseLabel: causeLabel(review.mistakeCause),
    confidence: review.confidence,
    causeSummary: review.causeSummary,
    fastestPath: review.fastestPath,
    transferRule: review.transferRule,
    createdAt: review.createdAt.toISOString(),
  };
}

export async function createQuestionMistakeReview(input: MistakeReviewInput) {
  return prisma.$transaction(async (tx) => {
    await tx.questionMistakeReview.updateMany({
      where: {
        userId: input.userId,
        questionId: input.questionId,
        isLatestForQuestion: true,
      },
      data: {
        isLatestForQuestion: false,
      },
    });

    return tx.questionMistakeReview.create({
      data: {
        userId: input.userId,
        questionId: input.questionId,
        sessionId: input.sessionId,
        practiceAnswerId: input.practiceAnswerId,
        tutorMessageId: input.tutorMessageId,
        tagId: input.tagId,
        mistakeCause: input.mistakeCause,
        confidence: input.confidence,
        causeSummary: input.causeSummary,
        fastestPath: input.fastestPath,
        transferRule: input.transferRule,
        timeSpentSeconds: input.timeSpentSeconds,
        isLatestForQuestion: true,
      },
    });
  });
}

export async function latestMistakeReviewMap(user: AuthenticatedUser, questionIds: string[]) {
  if (questionIds.length === 0) {
    return new Map<string, LatestMistakeReviewSummary>();
  }

  const reviews = await prisma.questionMistakeReview.findMany({
    where: {
      userId: user.id,
      questionId: { in: questionIds },
      isLatestForQuestion: true,
    },
  });

  return new Map(reviews.map((review) => [review.questionId, toLatestMistakeReviewSummary(review)]));
}

export async function getMistakeInsights(
  user: AuthenticatedUser,
  {
    range = "30",
    includeResolved = false,
  }: {
    range?: InsightRange;
    includeResolved?: boolean;
  } = {}
) {
  const start = rangeStart(range);
  const wrongQuestions = await prisma.wrongQuestion.findMany({
    where: {
      userId: user.id,
      ...(includeResolved ? {} : { resolvedAt: null }),
    },
    select: {
      questionId: true,
      tagId: true,
      tag: { select: { id: true, name: true } },
      question: { select: { tagId: true, tag: { select: { id: true, name: true } } } },
    },
  });
  const questionIds = wrongQuestions.map((item) => item.questionId);
  const tagByQuestionId = new Map(
    wrongQuestions.map((item) => [
      item.questionId,
      {
        tagId: item.tag?.id ?? item.question.tag?.id ?? item.tagId ?? item.question.tagId ?? null,
        tagName: item.tag?.name ?? item.question.tag?.name ?? "未分类",
      },
    ])
  );
  const latestReviews =
    questionIds.length > 0
      ? await prisma.questionMistakeReview.findMany({
          where: {
            userId: user.id,
            questionId: { in: questionIds },
            isLatestForQuestion: true,
            ...(start ? { createdAt: { gte: start } } : {}),
          },
          orderBy: { createdAt: "desc" },
        })
      : [];
  const latestQuestionIds = new Set(latestReviews.map((review) => review.questionId));
  const allLatestReviews =
    questionIds.length > 0
      ? await prisma.questionMistakeReview.findMany({
          where: {
            userId: user.id,
            questionId: { in: questionIds },
            isLatestForQuestion: true,
          },
          select: { questionId: true },
        })
      : [];
  const analyzedQuestionIds = new Set(allLatestReviews.map((review) => review.questionId));
  const distribution = causeOrder
    .map((cause) => ({
      cause,
      label: causeLabel(cause),
      count: latestReviews.filter((review) => review.mistakeCause === cause).length,
    }))
    .filter((item) => item.count > 0)
    .toSorted((first, second) => second.count - first.count);
  const dominantCause = distribution[0] ?? null;
  const records =
    questionIds.length > 0
      ? await prisma.questionMistakeReview.findMany({
          where: {
            userId: user.id,
            questionId: { in: questionIds },
            ...(start ? { createdAt: { gte: start } } : {}),
          },
          orderBy: { createdAt: "asc" },
        })
      : [];
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const trendStart =
    start ??
    (records[0]?.createdAt
      ? new Date(records[0].createdAt.getFullYear(), records[0].createdAt.getMonth(), records[0].createdAt.getDate())
      : end);
  const days = eachDay(trendStart, end);
  const trendBuckets = new Map(days.map((day) => [day, { day, total: 0 } as Record<string, number | string>]));

  for (const record of records) {
    const key = dateKey(record.createdAt);
    const bucket = trendBuckets.get(key);

    if (!bucket) {
      continue;
    }

    bucket.total = Number(bucket.total) + 1;
    bucket[record.mistakeCause] = Number(bucket[record.mistakeCause] ?? 0) + 1;
  }

  const trend = Array.from(trendBuckets.values());
  const averages = movingAverage(trend.map((item) => Number(item.total)));
  const tagCauseCounts = new Map<string, { tagId: string | null; tagName: string; cause: MistakeCause; count: number }>();

  for (const review of latestReviews) {
    if (!latestQuestionIds.has(review.questionId)) {
      continue;
    }

    const tag = tagByQuestionId.get(review.questionId) ?? { tagId: null, tagName: "未分类" };
    const key = `${tag.tagId ?? "untagged"}:${review.mistakeCause}`;
    const current = tagCauseCounts.get(key) ?? {
      tagId: tag.tagId,
      tagName: tag.tagName,
      cause: review.mistakeCause,
      count: 0,
    };

    current.count += 1;
    tagCauseCounts.set(key, current);
  }

  return {
    summary: {
      analyzedCount: analyzedQuestionIds.size,
      unanalyzedCount: Math.max(0, questionIds.length - analyzedQuestionIds.size),
      visibleAnalyzedCount: latestReviews.length,
      totalWrongQuestionCount: questionIds.length,
      dominantCause,
    },
    distribution,
    trend: trend.map((item, index) => ({
      ...item,
      movingAverage: averages[index] ?? 0,
    })),
    knowledgePatterns: Array.from(tagCauseCounts.values())
      .map((item) => ({
        ...item,
        label: causeLabel(item.cause),
      }))
      .toSorted((first, second) => second.count - first.count)
      .slice(0, 12),
  };
}
