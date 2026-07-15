import { z } from "zod";

import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/server/services/errors";
import { decimalToString } from "@/server/services/questions";

export const setExamGoalSchema = z.object({
  targetPaperId: z.string().min(1),
});

function paperSummary(paper: {
  id: string;
  title: string;
  year: number | null;
  province: string | null;
  examType: string | null;
  durationSeconds: number | null;
  difficultyScore: unknown;
}) {
  return {
    ...paper,
    difficultyScore: decimalToString(paper.difficultyScore),
  };
}

export async function listExamGoalPapers() {
  const papers = await prisma.paper.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: [{ year: "desc" }, { province: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      year: true,
      province: true,
      examType: true,
      durationSeconds: true,
      difficultyScore: true,
    },
  });

  return papers.map(paperSummary);
}

export async function findRecommendedBaselinePaper(targetPaperId: string) {
  const target = await prisma.paper.findFirst({
    where: { id: targetPaperId, isActive: true, deletedAt: null },
    select: { id: true, year: true, province: true, examType: true },
  });
  if (!target) throw new NotFoundError("目标试卷不存在");
  if (!target.year) return null;

  const baseline = await prisma.paper.findFirst({
    where: {
      isActive: true,
      deletedAt: null,
      id: { not: target.id },
      year: { lt: target.year },
      province: target.province,
      examType: target.examType,
    },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      year: true,
      province: true,
      examType: true,
      durationSeconds: true,
      difficultyScore: true,
    },
  });

  return baseline ? paperSummary(baseline) : null;
}

export async function getExamGoal(user: AuthenticatedUser) {
  const goal = await prisma.userExamGoal.findUnique({
    where: { userId: user.id },
    include: {
      targetPaper: true,
      baselineSession: {
        select: {
          id: true,
          title: true,
          status: true,
          score: true,
          maxScore: true,
          accuracy: true,
          elapsedSeconds: true,
          submittedAt: true,
        },
      },
    },
  });
  if (!goal) return null;

  const [recommendedBaseline, inProgressBaseline] = await Promise.all([
    findRecommendedBaselinePaper(goal.targetPaperId),
    prisma.practiceSession.findFirst({
      where: { userId: user.id, purpose: "BASELINE", status: "IN_PROGRESS" },
      orderBy: { createdAt: "desc" },
      select: { id: true, paperId: true, title: true },
    }),
  ]);

  return {
    id: goal.id,
    targetPaper: paperSummary(goal.targetPaper),
    recommendedBaseline,
    inProgressBaseline,
    baselineSession: goal.baselineSession
      ? {
          ...goal.baselineSession,
          score: decimalToString(goal.baselineSession.score),
          maxScore: decimalToString(goal.baselineSession.maxScore),
          accuracy: decimalToString(goal.baselineSession.accuracy),
          submittedAt: goal.baselineSession.submittedAt?.toISOString() ?? null,
        }
      : null,
  };
}

export async function setExamGoal(user: AuthenticatedUser, targetPaperId: string) {
  const target = await prisma.paper.findFirst({
    where: { id: targetPaperId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!target) throw new NotFoundError("目标试卷不存在");

  await prisma.userExamGoal.upsert({
    where: { userId: user.id },
    update: { targetPaperId, baselineSessionId: null },
    create: { userId: user.id, targetPaperId },
  });

  return getExamGoal(user);
}
