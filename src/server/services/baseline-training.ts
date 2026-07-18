import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { decimalToString } from "@/server/services/questions";

const baselineSummarySelect = {
  id: true,
  paperId: true,
  title: true,
  score: true,
  maxScore: true,
  accuracy: true,
  elapsedSeconds: true,
  submittedAt: true,
} as const;

export const submittedBaselineOrderBy = [
  { submittedAt: "asc" as const },
  { createdAt: "asc" as const },
];

function baselineSummary(session: {
  id: string;
  paperId: string | null;
  title: string;
  score: unknown;
  maxScore: unknown;
  accuracy: unknown;
  elapsedSeconds: number;
  submittedAt: Date | null;
}) {
  return {
    ...session,
    score: decimalToString(session.score),
    maxScore: decimalToString(session.maxScore),
    accuracy: decimalToString(session.accuracy),
    submittedAt: session.submittedAt?.toISOString() ?? null,
  };
}

export async function getBaselineTrainingState(user: AuthenticatedUser) {
  const [submitted, inProgress] = await Promise.all([
    prisma.practiceSession.findFirst({
      where: { userId: user.id, purpose: "BASELINE", status: "SUBMITTED" },
      orderBy: submittedBaselineOrderBy,
      select: baselineSummarySelect,
    }),
    prisma.practiceSession.findFirst({
      where: { userId: user.id, purpose: "BASELINE", status: "IN_PROGRESS" },
      orderBy: { createdAt: "desc" },
      select: { id: true, paperId: true, title: true },
    }),
  ]);

  return {
    submitted: submitted ? baselineSummary(submitted) : null,
    inProgress,
  };
}
