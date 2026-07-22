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
