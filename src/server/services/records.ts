import { z } from "zod";

import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/server/services/errors";
import {
  emptyStringToUndefined,
  getPagination,
  paginationQuerySchema,
} from "@/server/services/pagination";
import { getPracticeSessionDetail } from "@/server/services/practice";
import { decimalToString } from "@/server/services/questions";

export const recordsQuerySchema = paginationQuerySchema.extend({
  mode: z.preprocess(
    emptyStringToUndefined,
    z.enum(["PAPER", "SPECIAL", "DAILY", "WRONG", "MEMORIZE", "REVIEW"]).optional()
  ),
});

export type RecordsQuery = z.infer<typeof recordsQuerySchema>;

function toRecordListItem(session: {
  id: string;
  title: string;
  mode: string;
  totalCount: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  elapsedSeconds: number;
  score: unknown;
  maxScore: unknown;
  purpose: string;
  accuracy: unknown;
  submittedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: session.id,
    title: session.title,
    mode: session.mode,
    totalCount: session.totalCount,
    answeredCount: session.answeredCount,
    correctCount: session.correctCount,
    wrongCount: session.wrongCount,
    unansweredCount: session.unansweredCount,
    accuracy: decimalToString(session.accuracy),
    elapsedSeconds: session.elapsedSeconds,
    score: decimalToString(session.score),
    maxScore: decimalToString(session.maxScore),
    purpose: session.purpose,
    submittedAt: session.submittedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
  };
}

export async function listPracticeRecords(user: AuthenticatedUser, query: RecordsQuery) {
  const where = {
    userId: user.id,
    status: "SUBMITTED" as const,
    ...(query.mode ? { mode: query.mode } : {}),
  };

  const allSubmittedWhere = {
    userId: user.id,
    status: "SUBMITTED" as const,
  };

  const [items, total, summary] = await Promise.all([
    prisma.practiceSession.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        title: true,
        mode: true,
        totalCount: true,
        answeredCount: true,
        correctCount: true,
        wrongCount: true,
        unansweredCount: true,
        elapsedSeconds: true,
        score: true,
        maxScore: true,
        purpose: true,
        accuracy: true,
        submittedAt: true,
        createdAt: true,
      },
    }),
    prisma.practiceSession.count({ where }),
    prisma.practiceSession.aggregate({
      where: allSubmittedWhere,
      _count: { id: true },
      _sum: {
        totalCount: true,
        answeredCount: true,
        correctCount: true,
        wrongCount: true,
        unansweredCount: true,
        elapsedSeconds: true,
      },
    }),
  ]);

  const totalQuestions = summary._sum.totalCount ?? 0;
  const totalCorrect = summary._sum.correctCount ?? 0;
  const overallAccuracy =
    totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(2) : null;

  return {
    items: items.map(toRecordListItem),
    pagination: getPagination(query.page, query.pageSize, total),
    summary: {
      totalSessions: summary._count.id,
      totalQuestions,
      answeredCount: summary._sum.answeredCount ?? 0,
      correctCount: totalCorrect,
      wrongCount: summary._sum.wrongCount ?? 0,
      unansweredCount: summary._sum.unansweredCount ?? 0,
      totalElapsedSeconds: summary._sum.elapsedSeconds ?? 0,
      overallAccuracy,
    },
  };
}

export async function getPracticeRecordDetail(user: AuthenticatedUser, recordId: string) {
  const record = await prisma.practiceSession.findFirst({
    where: {
      id: recordId,
      userId: user.id,
      status: "SUBMITTED",
    },
    select: {
      id: true,
    },
  });

  if (!record) {
    throw new NotFoundError("练习记录不存在");
  }

  return getPracticeSessionDetail(user, record.id);
}
