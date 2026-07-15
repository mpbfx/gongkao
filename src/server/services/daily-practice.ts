import { z } from "zod";

import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { BusinessError, NotFoundError } from "@/server/services/errors";
import { createQuestionPracticeSession } from "@/server/services/practice";
import { assertPracticeQuestionsAccessible } from "@/server/services/practice-question-policy";

export const createDailySessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function chinaDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return `${valueByType.get("year")}-${valueByType.get("month")}-${valueByType.get("day")}`;
}

function utcDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

async function findDailyPractice(date?: string) {
  const targetDate = date ?? chinaDateString();
  const practice = await prisma.dailyPractice.findFirst({
    where: {
      date: utcDate(targetDate),
      isActive: true,
    },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        include: {
          question: {
            include: {
              material: { select: { id: true, title: true, contentHtml: true } },
              tag: { select: { id: true, name: true } },
              options: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
    },
  });

  if (practice) {
    return { practice, targetDate, isFallback: false };
  }

  const fallback = await prisma.dailyPractice.findFirst({
    where: { isActive: true },
    orderBy: { date: "desc" },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        include: {
          question: {
            include: {
              material: { select: { id: true, title: true, contentHtml: true } },
              tag: { select: { id: true, name: true } },
              options: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
    },
  });

  return fallback ? { practice: fallback, targetDate, isFallback: true } : null;
}

export async function getTodayDailyPractice(user?: AuthenticatedUser | null) {
  const daily = await findDailyPractice();

  if (!daily) {
    throw new NotFoundError("今日暂未配置每日一练");
  }

  const completedSession = user
    ? await prisma.practiceSession.findFirst({
        where: {
          userId: user.id,
          mode: "DAILY",
          title: daily.practice.title,
          status: "SUBMITTED",
        },
        orderBy: { submittedAt: "desc" },
        select: { id: true, submittedAt: true, accuracy: true },
      })
    : null;

  return {
    id: daily.practice.id,
    date: daily.practice.date.toISOString().slice(0, 10),
    requestedDate: daily.targetDate,
    title: daily.practice.title,
    questionCount: daily.practice.questions.length,
    isFallback: daily.isFallback,
    completedSession: completedSession
      ? {
          id: completedSession.id,
          submittedAt: completedSession.submittedAt?.toISOString() ?? null,
          accuracy: String(completedSession.accuracy ?? "0.00"),
        }
      : null,
  };
}

export async function createDailyPracticeSession(
  user: AuthenticatedUser,
  input: z.infer<typeof createDailySessionSchema>
) {
  const daily = await findDailyPractice(input.date);

  if (!daily) {
    throw new NotFoundError("每日一练不存在");
  }

  if (daily.practice.questions.length === 0) {
    throw new BusinessError("每日一练暂无题目");
  }

  await assertPracticeQuestionsAccessible(
    user,
    daily.practice.questions.map((item) => item.question)
  );

  return createQuestionPracticeSession({
    user,
    mode: "DAILY",
    title: daily.practice.title,
    questions: daily.practice.questions.map((item) => item.question),
  });
}
