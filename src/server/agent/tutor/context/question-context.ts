import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { stripHtml, truncateText } from "@/server/agent/shared/text";
import { BusinessError, NotFoundError } from "@/server/services/errors";

export type TutorInput = {
  user: AuthenticatedUser;
  questionId: string;
  sessionId?: string;
  prompt: string;
  mode?: "chat" | "knowledge";
};

export type TutorQuestionContext = {
  questionId: string;
  sessionId?: string;
  practiceAnswerId: string | null;
  title: string;
  material: string;
  options: Array<{ label: string; value: string; content: string }>;
  correctAnswer: string;
  analysis: string;
  userAnswer: string | null;
  tagId: string | null;
  tagName: string | null;
  questionType: string;
  difficulty: string;
  source: string | null;
  wrongCount: number;
  timeSpentSeconds: number | null;
  sessionAverageTimeSeconds: number | null;
  userAverageTimeSeconds: number | null;
  tagAverageTimeSeconds: number | null;
  hasOfficialAnalysis: boolean;
  hasImageContent: boolean;
};

function hasImageHtml(...values: Array<string | null | undefined>) {
  return values.some((value) => /<img\b/i.test(value ?? ""));
}

async function loadTimeAverages(userId: string, tagId: string | null, sessionId?: string | null) {
  const [sessionAverage, userAverage, tagAverage] = await Promise.all([
    sessionId
      ? prisma.practiceAnswer.aggregate({
          where: { userId, sessionId, timeSpentSeconds: { gt: 0 } },
          _avg: { timeSpentSeconds: true },
        })
      : null,
    prisma.practiceAnswer.aggregate({
      where: { userId, timeSpentSeconds: { gt: 0 } },
      _avg: { timeSpentSeconds: true },
    }),
    tagId
      ? prisma.practiceAnswer.aggregate({
          where: { userId, timeSpentSeconds: { gt: 0 }, question: { tagId } },
          _avg: { timeSpentSeconds: true },
        })
      : null,
  ]);

  return {
    sessionAverageTimeSeconds: sessionAverage?._avg.timeSpentSeconds
      ? Math.round(sessionAverage._avg.timeSpentSeconds)
      : null,
    userAverageTimeSeconds: userAverage._avg.timeSpentSeconds ? Math.round(userAverage._avg.timeSpentSeconds) : null,
    tagAverageTimeSeconds: tagAverage?._avg.timeSpentSeconds ? Math.round(tagAverage._avg.timeSpentSeconds) : null,
  };
}

function questionFields(question: {
  id: string;
  type: string;
  titleHtml: string;
  analysisHtml: string | null;
  correctAnswer: string;
  difficulty: string;
  source: string | null;
  material: { contentHtml: string; plainText: string | null } | null;
  tag: { id: string; name: string } | null;
  tagId: string | null;
  options: Array<{ label: string; value: string; contentHtml: string; plainText: string | null }>;
}) {
  return {
    questionId: question.id,
    title: truncateText(stripHtml(question.titleHtml)),
    material: truncateText(stripHtml(question.material?.plainText ?? question.material?.contentHtml)),
    options: question.options.map((option) => ({
      label: option.label,
      value: option.value,
      content: stripHtml(option.plainText ?? option.contentHtml),
    })),
    correctAnswer: question.correctAnswer,
    analysis: truncateText(stripHtml(question.analysisHtml)),
    tagId: question.tag?.id ?? question.tagId ?? null,
    tagName: question.tag?.name ?? null,
    questionType: question.type,
    difficulty: question.difficulty,
    source: question.source,
    hasOfficialAnalysis: Boolean(stripHtml(question.analysisHtml)),
    hasImageContent: hasImageHtml(question.titleHtml, question.material?.contentHtml, question.analysisHtml),
  };
}

const questionInclude = {
  material: { select: { contentHtml: true, plainText: true } },
  tag: { select: { id: true, name: true } },
  options: { orderBy: { sortOrder: "asc" as const } },
};

async function loadFromSession(input: TutorInput) {
  const answer = await prisma.practiceAnswer.findFirst({
    where: { sessionId: input.sessionId, questionId: input.questionId, userId: input.user.id },
    include: {
      session: { select: { status: true, mode: true } },
      question: { include: questionInclude },
    },
  });

  if (!answer) throw new NotFoundError("题目不存在或无权限");
  if (answer.session.status !== "SUBMITTED" && answer.session.mode !== "MEMORIZE") {
    throw new BusinessError("未提交练习不开放讲题助教");
  }

  const base = questionFields(answer.question);
  const wrong = await prisma.wrongQuestion.findUnique({
    where: { userId_questionId: { userId: input.user.id, questionId: input.questionId } },
    select: { wrongCount: true },
  });

  return {
    ...base,
    sessionId: answer.sessionId,
    practiceAnswerId: answer.id,
    userAnswer: answer.answer,
    wrongCount: wrong?.wrongCount ?? 0,
    timeSpentSeconds: answer.timeSpentSeconds,
    ...(await loadTimeAverages(input.user.id, base.tagId, answer.sessionId)),
  } satisfies TutorQuestionContext;
}

async function loadFromWrongQuestion(input: TutorInput) {
  const wrong = await prisma.wrongQuestion.findUnique({
    where: { userId_questionId: { userId: input.user.id, questionId: input.questionId } },
    include: {
      question: { include: questionInclude },
      lastAnswer: { select: { id: true, sessionId: true, answer: true, timeSpentSeconds: true } },
    },
  });

  if (!wrong) throw new NotFoundError("错题不存在或无权限");
  const base = questionFields(wrong.question);

  return {
    ...base,
    sessionId: wrong.lastAnswer?.sessionId,
    practiceAnswerId: wrong.lastAnswer?.id ?? null,
    userAnswer: wrong.lastAnswer?.answer ?? null,
    wrongCount: wrong.wrongCount,
    timeSpentSeconds: wrong.lastAnswer?.timeSpentSeconds ?? null,
    ...(await loadTimeAverages(input.user.id, base.tagId, wrong.lastAnswer?.sessionId)),
  } satisfies TutorQuestionContext;
}

export function loadTutorQuestionContext(input: TutorInput) {
  return input.sessionId ? loadFromSession(input) : loadFromWrongQuestion(input);
}
