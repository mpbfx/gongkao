import { normalizeAnswer } from "@/server/services/questions";

export type PracticeProgressAnswer = {
  questionId: string;
  answer?: string | null;
  timeSpentSeconds?: number;
  decisionNote?: string | null;
};

export function normalizePracticeProgressAnswers(
  submittedAnswers: PracticeProgressAnswer[]
) {
  return submittedAnswers.map((submittedAnswer) => {
    const answer = normalizeAnswer(submittedAnswer.answer);

    return {
      questionId: submittedAnswer.questionId,
      answer: answer || null,
      timeSpentSeconds: submittedAnswer.timeSpentSeconds ?? 0,
      decisionNote: submittedAnswer.decisionNote?.trim() || null,
    };
  });
}

export function getPreviouslyGradedQuestionIds(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return new Set<string>();
  }

  const reopenedSubmission = (metadata as Record<string, unknown>).reopenedSubmission;
  if (
    !reopenedSubmission ||
    typeof reopenedSubmission !== "object" ||
    Array.isArray(reopenedSubmission)
  ) {
    return new Set<string>();
  }

  const questionIds = (reopenedSubmission as Record<string, unknown>).gradedQuestionIds;
  return new Set(
    Array.isArray(questionIds)
      ? questionIds.filter((questionId): questionId is string => typeof questionId === "string")
      : []
  );
}
