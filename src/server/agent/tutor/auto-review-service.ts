import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { loadTutorQuestionContext } from "@/server/agent/tutor/context/question-context";
import { replaceLatestMistakeReview } from "@/server/agent/tutor/persistence/mistake-reviews";
import { automaticReviewPrompt } from "@/server/agent/tutor/prompts/tutor-system-prompt";
import { runTutorAgent } from "@/server/agent/tutor/runtime/run-tutor-agent";

async function analyzeQuestion(user: AuthenticatedUser, sessionId: string, questionId: string) {
  const context = await loadTutorQuestionContext({
    user,
    sessionId,
    questionId,
    prompt: automaticReviewPrompt,
  });
  const result = await runTutorAgent({
    userId: user.id,
    context,
    messages: [],
    prompt: automaticReviewPrompt,
    enableKnowledge: false,
  });

  await prisma.$transaction((tx) =>
    replaceLatestMistakeReview(tx, {
      userId: user.id,
      context,
      review: result.review,
    })
  );
}

export async function autoAnalyzeSubmittedSessionMistakes(
  user: AuthenticatedUser,
  sessionId: string,
  { maxQuestions }: { maxQuestions: number }
) {
  const session = await prisma.practiceSession.findFirst({
    where: { id: sessionId, userId: user.id, status: "SUBMITTED" },
    select: { id: true },
  });
  if (!session) return { analyzed: 0, skipped: 0, failed: 0 };

  const wrongAnswers = await prisma.practiceAnswer.findMany({
    where: { sessionId, userId: user.id, isCorrect: false, answer: { not: null } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, questionId: true },
  });
  const existing = await prisma.questionMistakeReview.findMany({
    where: { practiceAnswerId: { in: wrongAnswers.map((answer) => answer.id) } },
    select: { practiceAnswerId: true },
  });
  const reviewedIds = new Set(existing.map((review) => review.practiceAnswerId).filter(Boolean));
  const candidates = wrongAnswers
    .filter((answer) => !reviewedIds.has(answer.id))
    .slice(0, Math.max(0, maxQuestions));
  let analyzed = 0;
  let failed = 0;

  for (const answer of candidates) {
    try {
      await analyzeQuestion(user, sessionId, answer.questionId);
      analyzed += 1;
    } catch (error) {
      failed += 1;
      console.error("Auto mistake review failed", { sessionId, questionId: answer.questionId, error });
    }
  }

  return { analyzed, skipped: wrongAnswers.length - candidates.length, failed };
}
