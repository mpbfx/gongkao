import type { Prisma } from "@/generated/prisma/client";
import type { TutorQuestionContext } from "@/server/agent/tutor/context/question-context";
import type { TutorMistakeReview } from "@/server/agent/tutor/schemas/tutor-schemas";

export async function replaceLatestMistakeReview(
  tx: Prisma.TransactionClient,
  {
    userId,
    context,
    review,
    tutorMessageId,
  }: {
    userId: string;
    context: TutorQuestionContext;
    review: TutorMistakeReview;
    tutorMessageId?: string;
  }
) {
  await tx.questionMistakeReview.updateMany({
    where: { userId, questionId: context.questionId, isLatestForQuestion: true },
    data: { isLatestForQuestion: false },
  });

  return tx.questionMistakeReview.create({
    data: {
      userId,
      questionId: context.questionId,
      sessionId: context.sessionId,
      practiceAnswerId: context.practiceAnswerId,
      tutorMessageId,
      tagId: context.tagId,
      mistakeCause: review.mistakeCause,
      confidence: review.confidence,
      causeSummary: review.causeSummary,
      fastestPath: review.fastestPath,
      transferRule: review.transferRule,
      timeSpentSeconds: context.timeSpentSeconds,
      isLatestForQuestion: true,
    },
  });
}
