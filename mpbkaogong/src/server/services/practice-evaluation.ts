import { normalizeAnswer } from "@/server/services/questions";

export type EvaluationQuestion = {
  questionId: string;
  correctAnswer: string;
  score?: number | string | null;
  sectionName?: string | null;
};

export type EvaluationAnswer = {
  questionId: string;
  answer?: string | null;
  timeSpentSeconds?: number;
};

export function evaluatePracticeAnswers(
  questions: EvaluationQuestion[],
  submittedAnswers: EvaluationAnswer[]
) {
  const submittedByQuestionId = new Map(
    submittedAnswers.map((answer) => [answer.questionId, answer])
  );
  const sections = new Map<
    string,
    {
      name: string;
      totalCount: number;
      answeredCount: number;
      correctCount: number;
      score: number;
      maxScore: number;
      elapsedSeconds: number;
    }
  >();
  let answeredCount = 0;
  let correctCount = 0;
  let score = 0;
  let maxScore = 0;

  const answers = questions.map((question) => {
    const submitted = submittedByQuestionId.get(question.questionId);
    const answer = normalizeAnswer(submitted?.answer);
    const correctAnswer = normalizeAnswer(question.correctAnswer);
    const isAnswered = answer.length > 0;
    const isCorrect = isAnswered && answer === correctAnswer;
    const questionScore = Number(question.score ?? 1);
    const safeScore = Number.isFinite(questionScore) ? questionScore : 1;
    const earnedScore = isCorrect ? safeScore : 0;
    const sectionName = question.sectionName ?? "综合";
    const section = sections.get(sectionName) ?? {
      name: sectionName,
      totalCount: 0,
      answeredCount: 0,
      correctCount: 0,
      score: 0,
      maxScore: 0,
      elapsedSeconds: 0,
    };

    answeredCount += isAnswered ? 1 : 0;
    correctCount += isCorrect ? 1 : 0;
    score += earnedScore;
    maxScore += safeScore;
    section.totalCount += 1;
    section.answeredCount += isAnswered ? 1 : 0;
    section.correctCount += isCorrect ? 1 : 0;
    section.score += earnedScore;
    section.maxScore += safeScore;
    section.elapsedSeconds += submitted?.timeSpentSeconds ?? 0;
    sections.set(sectionName, section);

    return {
      questionId: question.questionId,
      answer: isAnswered ? answer : null,
      correctAnswer,
      isCorrect: isAnswered ? isCorrect : false,
      timeSpentSeconds: submitted?.timeSpentSeconds ?? 0,
      earnedScore,
      maxScore: safeScore,
      sectionName,
    };
  });
  const totalCount = questions.length;
  const wrongCount = answeredCount - correctCount;
  const unansweredCount = totalCount - answeredCount;

  return {
    answers,
    totalCount,
    answeredCount,
    correctCount,
    wrongCount,
    unansweredCount,
    accuracy: totalCount > 0 ? Number(((correctCount / totalCount) * 100).toFixed(2)) : 0,
    score: Number(score.toFixed(2)),
    maxScore: Number(maxScore.toFixed(2)),
    sections: Array.from(sections.values()).map((section) => ({
      ...section,
      score: Number(section.score.toFixed(2)),
      maxScore: Number(section.maxScore.toFixed(2)),
      accuracy:
        section.totalCount > 0
          ? Number(((section.correctCount / section.totalCount) * 100).toFixed(2))
          : 0,
    })),
  };
}

export function evaluateFoundationRound({
  totalCount,
  correctCount,
  threshold = 9,
}: {
  totalCount: number;
  correctCount: number;
  threshold?: number;
}) {
  return {
    passed: totalCount === 15 && correctCount >= threshold,
    correctCount,
    threshold,
  };
}
