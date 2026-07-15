import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { cleanLearningTitle } from "@/lib/display-title";
import { listPracticeRecords, recordsQuerySchema } from "@/server/services/records";

const DAY_MS = 24 * 60 * 60 * 1000;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const HEATMAP_WEEK_COUNT = 8;
const HEATMAP_TAG_COUNT = 8;
const LIMITED_SAMPLE_COUNT = 3;

export type AccuracyTrendPoint = {
  id: string;
  title: string;
  mode: string;
  modeLabel: string;
  submittedAt: string;
  dateLabel: string;
  accuracy: number;
  answeredCount: number;
  totalCount: number;
};

export type KnowledgeWeek = {
  key: string;
  label: string;
  rangeLabel: string;
};

export type KnowledgeTag = {
  id: string;
  name: string;
  answeredCount: number;
};

export type WeeklyKnowledgeCell = {
  weekKey: string;
  tagId: string;
  tagName: string;
  answeredCount: number;
  correctCount: number;
  accuracy: number | null;
  sampleStatus: "none" | "limited" | "sufficient";
};

export type WeakKnowledgeItem = {
  tagId: string | null;
  tagName: string;
  unresolvedCount: number;
  highRepeatCount: number;
  answeredCount: number;
  correctCount: number;
  accuracy: number | null;
};

export type PracticeModeComparisonItem = {
  mode: string;
  label: string;
  sessionCount: number;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  accuracy: number | null;
};

export type LearningSituation = {
  summary: {
    totalSessions: number;
    totalQuestions: number;
    answeredCount: number;
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    totalElapsedSeconds: number;
    overallAccuracy: string | null;
  };
  wrongSummary: {
    totalCount: number;
    unresolvedCount: number;
    resolvedCount: number;
    resolvedRate: number | null;
  };
  accuracyTrend: AccuracyTrendPoint[];
  modeComparison: PracticeModeComparisonItem[];
  knowledgeHeatmap: {
    weeks: KnowledgeWeek[];
    tags: KnowledgeTag[];
    cells: WeeklyKnowledgeCell[];
  };
  weakKnowledge: WeakKnowledgeItem[];
  recentRecords: Array<{
    id: string;
    title: string;
    modeLabel: string;
    submittedAt: string | null;
    accuracy: string | null;
  }>;
};

type WeeklyAnswer = {
  isCorrect: boolean;
  submittedAt: Date;
  tagId: string | null;
  tagName: string;
};

type TrendRecord = {
  id: string;
  title: string;
  mode: string;
  submittedAt: string | null;
  accuracy: string | null;
  answeredCount: number;
  totalCount: number;
};

function modeLabel(mode: string) {
  const labels: Record<string, string> = {
    PAPER: "真题",
    SPECIAL: "专项",
    DAILY: "日练",
    WRONG: "错题",
    MEMORIZE: "错题复盘",
    REVIEW: "回看",
  };

  return labels[mode] ?? mode;
}

function shanghaiDateParts(value: Date) {
  const shifted = new Date(value.getTime() + SHANGHAI_OFFSET_MS);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    date: shifted.getUTCDate(),
    day: shifted.getUTCDay(),
  };
}

export function startOfShanghaiWeekUtc(value: Date) {
  const parts = shanghaiDateParts(value);
  const daysSinceMonday = (parts.day + 6) % 7;
  const shanghaiMidnightUtc = Date.UTC(parts.year, parts.month, parts.date);

  return new Date(shanghaiMidnightUtc - daysSinceMonday * DAY_MS - SHANGHAI_OFFSET_MS);
}

function shanghaiDateKey(value: Date) {
  return new Date(value.getTime() + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}

function formatShanghaiDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function buildKnowledgeWeeks(now: Date, count = HEATMAP_WEEK_COUNT) {
  const currentWeek = startOfShanghaiWeekUtc(now);

  return Array.from({ length: count }, (_, index) => {
    const start = new Date(currentWeek.getTime() - (count - index - 1) * 7 * DAY_MS);
    const end = new Date(start.getTime() + 6 * DAY_MS);

    return {
      key: shanghaiDateKey(start),
      label: formatShanghaiDate(start),
      rangeLabel: `${formatShanghaiDate(start)}—${formatShanghaiDate(end)}`,
      start,
    };
  });
}

export function buildWeeklyKnowledgeHeatmap(
  answers: WeeklyAnswer[],
  now: Date,
  tagLimit = HEATMAP_TAG_COUNT
) {
  const weeks = buildKnowledgeWeeks(now);
  const weekKeys = new Set(weeks.map((week) => week.key));
  const tagTotals = new Map<string, KnowledgeTag>();
  const buckets = new Map<string, { answeredCount: number; correctCount: number }>();

  for (const answer of answers) {
    const weekKey = shanghaiDateKey(startOfShanghaiWeekUtc(answer.submittedAt));

    if (!weekKeys.has(weekKey)) {
      continue;
    }

    const tagId = answer.tagId ?? "untagged";
    const tag = tagTotals.get(tagId) ?? {
      id: tagId,
      name: answer.tagName || "未分类",
      answeredCount: 0,
    };
    tag.answeredCount += 1;
    tagTotals.set(tagId, tag);

    const bucketKey = `${weekKey}:${tagId}`;
    const bucket = buckets.get(bucketKey) ?? { answeredCount: 0, correctCount: 0 };
    bucket.answeredCount += 1;
    bucket.correctCount += answer.isCorrect ? 1 : 0;
    buckets.set(bucketKey, bucket);
  }

  const tags = Array.from(tagTotals.values())
    .toSorted((first, second) =>
      second.answeredCount - first.answeredCount || first.name.localeCompare(second.name, "zh-CN")
    )
    .slice(0, tagLimit);
  const cells = tags.flatMap((tag) =>
    weeks.map((week) => {
      const bucket = buckets.get(`${week.key}:${tag.id}`);
      const answeredCount = bucket?.answeredCount ?? 0;
      const correctCount = bucket?.correctCount ?? 0;

      return {
        weekKey: week.key,
        tagId: tag.id,
        tagName: tag.name,
        answeredCount,
        correctCount,
        accuracy:
          answeredCount > 0 ? Number(((correctCount / answeredCount) * 100).toFixed(2)) : null,
        sampleStatus:
          answeredCount === 0
            ? "none"
            : answeredCount < LIMITED_SAMPLE_COUNT
              ? "limited"
              : "sufficient",
      } satisfies WeeklyKnowledgeCell;
    })
  );

  return {
    weeks: weeks.map(({ key, label, rangeLabel }) => ({ key, label, rangeLabel })),
    tags,
    cells,
  };
}

export function buildAccuracyTrend(records: TrendRecord[]) {
  return records
    .filter(
      (record): record is TrendRecord & { submittedAt: string; accuracy: string } =>
        Boolean(record.submittedAt && record.accuracy !== null)
    )
    .toSorted(
      (first, second) =>
        new Date(first.submittedAt).getTime() - new Date(second.submittedAt).getTime()
    )
    .map((record) => ({
      id: record.id,
      title: cleanLearningTitle(record.title),
      mode: record.mode,
      modeLabel: modeLabel(record.mode),
      submittedAt: record.submittedAt,
      dateLabel: formatShanghaiDate(new Date(record.submittedAt)),
      accuracy: Number(record.accuracy),
      answeredCount: record.answeredCount,
      totalCount: record.totalCount,
    } satisfies AccuracyTrendPoint));
}

export async function getLearningSituation(
  user: AuthenticatedUser,
  now = new Date()
): Promise<LearningSituation> {
  const [records, answerRows, wrongRows, modeRows] = await Promise.all([
    listPracticeRecords(user, recordsQuerySchema.parse({ pageSize: 12 })),
    prisma.practiceAnswer.findMany({
      where: {
        userId: user.id,
        isCorrect: { not: null },
        session: { status: "SUBMITTED" },
      },
      select: {
        isCorrect: true,
        session: { select: { submittedAt: true } },
        question: {
          select: {
            tagId: true,
            tag: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.wrongQuestion.findMany({
      where: { userId: user.id },
      select: {
        wrongCount: true,
        resolvedAt: true,
        tagId: true,
        tag: { select: { id: true, name: true } },
        question: {
          select: {
            tagId: true,
            tag: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.practiceSession.groupBy({
      by: ["mode"],
      where: { userId: user.id, status: "SUBMITTED" },
      _count: { id: true },
      _sum: {
        totalCount: true,
        answeredCount: true,
        correctCount: true,
        wrongCount: true,
        unansweredCount: true,
      },
    }),
  ]);

  const weeklyAnswers: WeeklyAnswer[] = answerRows.flatMap((answer) => {
    if (answer.isCorrect === null || !answer.session.submittedAt) {
      return [];
    }

    return [{
      isCorrect: answer.isCorrect,
      submittedAt: answer.session.submittedAt,
      tagId: answer.question.tag?.id ?? answer.question.tagId ?? null,
      tagName: answer.question.tag?.name ?? "未分类",
    }];
  });
  const tagPerformance = new Map<string, { answeredCount: number; correctCount: number }>();

  for (const answer of weeklyAnswers) {
    const key = answer.tagId ?? "untagged";
    const performance = tagPerformance.get(key) ?? { answeredCount: 0, correctCount: 0 };
    performance.answeredCount += 1;
    performance.correctCount += answer.isCorrect ? 1 : 0;
    tagPerformance.set(key, performance);
  }

  const weakGroups = new Map<string, WeakKnowledgeItem>();
  let resolvedCount = 0;

  for (const wrong of wrongRows) {
    if (wrong.resolvedAt) {
      resolvedCount += 1;
      continue;
    }

    const tagId = wrong.tag?.id ?? wrong.question.tag?.id ?? wrong.tagId ?? wrong.question.tagId ?? null;
    const tagName = wrong.tag?.name ?? wrong.question.tag?.name ?? "未分类";
    const key = tagId ?? "untagged";
    const performance = tagPerformance.get(key) ?? { answeredCount: 0, correctCount: 0 };
    const group = weakGroups.get(key) ?? {
      tagId,
      tagName,
      unresolvedCount: 0,
      highRepeatCount: 0,
      answeredCount: performance.answeredCount,
      correctCount: performance.correctCount,
      accuracy:
        performance.answeredCount > 0
          ? Number(((performance.correctCount / performance.answeredCount) * 100).toFixed(2))
          : null,
    };
    group.unresolvedCount += 1;
    group.highRepeatCount += wrong.wrongCount >= 2 ? 1 : 0;
    weakGroups.set(key, group);
  }

  const unresolvedCount = wrongRows.length - resolvedCount;
  const weakKnowledge = Array.from(weakGroups.values())
    .toSorted((first, second) =>
      second.highRepeatCount - first.highRepeatCount ||
      second.unresolvedCount - first.unresolvedCount ||
      first.tagName.localeCompare(second.tagName, "zh-CN")
    )
    .slice(0, 8);
  const modeOrder = ["PAPER", "SPECIAL", "DAILY", "WRONG", "MEMORIZE", "REVIEW"];
  const modeComparison = modeRows
    .map((row) => {
      const totalQuestions = row._sum.totalCount ?? 0;
      const correctCount = row._sum.correctCount ?? 0;

      return {
        mode: row.mode,
        label: modeLabel(row.mode),
        sessionCount: row._count.id,
        totalQuestions,
        answeredCount: row._sum.answeredCount ?? 0,
        correctCount,
        wrongCount: row._sum.wrongCount ?? 0,
        unansweredCount: row._sum.unansweredCount ?? 0,
        accuracy:
          totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 100).toFixed(2)) : null,
      } satisfies PracticeModeComparisonItem;
    })
    .toSorted((first, second) => modeOrder.indexOf(first.mode) - modeOrder.indexOf(second.mode));

  return {
    summary: records.summary,
    wrongSummary: {
      totalCount: wrongRows.length,
      unresolvedCount,
      resolvedCount,
      resolvedRate:
        wrongRows.length > 0 ? Number(((resolvedCount / wrongRows.length) * 100).toFixed(2)) : null,
    },
    accuracyTrend: buildAccuracyTrend(records.items),
    modeComparison,
    knowledgeHeatmap: buildWeeklyKnowledgeHeatmap(weeklyAnswers, now),
    weakKnowledge,
    recentRecords: records.items.slice(0, 3).map((record) => ({
      id: record.id,
      title: cleanLearningTitle(record.title),
      modeLabel: modeLabel(record.mode),
      submittedAt: record.submittedAt,
      accuracy: record.accuracy,
    })),
  };
}
