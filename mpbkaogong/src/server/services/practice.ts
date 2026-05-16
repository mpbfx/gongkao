import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, MembershipRequiredError, NotFoundError } from "@/server/services/errors";
import { hasActiveMembership } from "@/server/services/membership";
import { toPaperModel } from "@/server/services/papers";
import {
  decimalToString,
  normalizeAnswer,
  normalizeRichHtml,
  toQuestionDto,
} from "@/server/services/questions";

export const createPaperSessionSchema = z.object({
  paperId: z.string().min(1),
  mode: z.literal("PAPER").optional(),
});

export const submitSessionSchema = z.object({
  elapsedSeconds: z.coerce.number().int().min(0).default(0),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.string().trim().nullable().optional(),
        timeSpentSeconds: z.coerce.number().int().min(0).default(0),
      })
    )
    .default([]),
});

export type SubmitSessionInput = z.infer<typeof submitSessionSchema>;

function getSessionModel(
  answers: Array<{
    sortOrder: number;
    question: {
      paperQuestions?: Array<{
        paperId: string;
        sectionName: string | null;
        sortOrder: number;
      }>;
    };
  }>,
  paperId?: string | null
) {
  return toPaperModel(
    answers.map((answer) => {
      const paperQuestion = paperId
        ? answer.question.paperQuestions?.find((item) => item.paperId === paperId)
        : null;

      return {
        sortOrder: answer.sortOrder,
        sectionName: paperQuestion?.sectionName ?? null,
      };
    })
  );
}

export function sessionSummary(session: {
  id: string;
  title: string;
  mode: string;
  status: string;
  totalCount: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  elapsedSeconds: number;
  accuracy?: unknown;
  submittedAt?: Date | null;
  createdAt: Date;
  paperId?: string | null;
}) {
  return {
    id: session.id,
    title: session.title,
    mode: session.mode,
    status: session.status,
    totalCount: session.totalCount,
    answeredCount: session.answeredCount,
    correctCount: session.correctCount,
    wrongCount: session.wrongCount,
    unansweredCount: session.unansweredCount,
    elapsedSeconds: session.elapsedSeconds,
    accuracy: decimalToString(session.accuracy),
    submittedAt: session.submittedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    paperId: session.paperId ?? null,
  };
}

type QuestionForSession = {
  id: string;
  type: string;
  titleHtml: string;
  analysisHtml?: string | null;
  difficulty: string;
  globalAccuracy?: unknown;
  source?: string | null;
  correctAnswer?: string;
  material?: {
    id: string;
    title?: string | null;
    contentHtml: string;
  } | null;
  tag?: {
    id: string;
    name: string;
  } | null;
  options: Array<{
    id: string;
    label: string;
    value: string;
    contentHtml: string;
    sortOrder: number;
  }>;
};

function modelFromQuestions(questions: QuestionForSession[]) {
  const sections = new Map<string, { name: string; snum: number; enum: number }>();

  questions.forEach((question, index) => {
    const sortOrder = index + 1;
    const name = question.tag?.name ?? "综合";
    const current = sections.get(name);

    if (current) {
      current.enum = sortOrder;
    } else {
      sections.set(name, {
        name,
        snum: sortOrder,
        enum: sortOrder,
      });
    }
  });

  return Array.from(sections.values());
}

export async function createQuestionPracticeSession({
  user,
  mode,
  title,
  questions,
  sourceTagIdsJson,
  difficulty,
}: {
  user: AuthenticatedUser;
  mode: "SPECIAL" | "DAILY" | "WRONG" | "MEMORIZE";
  title: string;
  questions: QuestionForSession[];
  sourceTagIdsJson?: Prisma.InputJsonValue;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | "UNKNOWN" | null;
}) {
  const session = await prisma.practiceSession.create({
    data: {
      userId: user.id,
      mode,
      status: "IN_PROGRESS",
      title,
      sourceTagIdsJson,
      difficulty,
      totalCount: questions.length,
      unansweredCount: questions.length,
      answers: {
        create: questions.map((question, index) => ({
          userId: user.id,
          questionId: question.id,
          sortOrder: index + 1,
          answer: null,
          isCorrect: null,
          timeSpentSeconds: 0,
        })),
      },
    },
  });

  return {
    ...sessionSummary(session),
    model: modelFromQuestions(questions),
    questions: questions.map((question, index) => ({
      sortOrder: index + 1,
      sectionName: question.tag?.name ?? "综合",
      ...toQuestionDto(question, mode === "MEMORIZE"),
    })),
    userAnswers: [],
  };
}

export async function createPaperPracticeSession(user: AuthenticatedUser, paperId: string) {
  const paper = await prisma.paper.findFirst({
    where: {
      id: paperId,
      isActive: true,
      deletedAt: null,
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

  if (!paper) {
    throw new NotFoundError("试卷不存在");
  }

  const requiresMembership =
    paper.isVipOnly || paper.questions.some((paperQuestion) => paperQuestion.question.isVipOnly);

  if (requiresMembership && !(await hasActiveMembership(user.id, user.role))) {
    throw new MembershipRequiredError("该试卷需要会员权限");
  }

  const session = await prisma.practiceSession.create({
    data: {
      userId: user.id,
      mode: "PAPER",
      status: "IN_PROGRESS",
      title: paper.title,
      paperId: paper.id,
      totalCount: paper.questions.length,
      unansweredCount: paper.questions.length,
      answers: {
        create: paper.questions.map((paperQuestion) => ({
          userId: user.id,
          questionId: paperQuestion.questionId,
          sortOrder: paperQuestion.sortOrder,
          answer: null,
          isCorrect: null,
          timeSpentSeconds: 0,
        })),
      },
    },
  });

  return {
    ...sessionSummary(session),
    model: toPaperModel(paper.questions),
    questions: paper.questions.map((paperQuestion) => ({
      sortOrder: paperQuestion.sortOrder,
      sectionName: paperQuestion.sectionName,
      score: decimalToString(paperQuestion.score),
      ...toQuestionDto(paperQuestion.question, false),
    })),
    userAnswers: [],
  };
}

export async function getPracticeSessionDetail(user: AuthenticatedUser, sessionId: string) {
  const session = await prisma.practiceSession.findFirst({
    where: {
      id: sessionId,
      userId: user.id,
    },
    include: {
      answers: {
        orderBy: { sortOrder: "asc" },
        include: {
          question: {
            include: {
              material: { select: { id: true, title: true, contentHtml: true } },
              tag: { select: { id: true, name: true } },
              options: { orderBy: { sortOrder: "asc" } },
              paperQuestions: sessionId
                ? {
                    select: { paperId: true, sectionName: true, sortOrder: true },
                  }
                : true,
            },
          },
        },
      },
    },
  });

  if (!session) {
    throw new NotFoundError("练习不存在");
  }

  const includeAnswer = session.status === "SUBMITTED" || session.mode === "MEMORIZE";

  return {
    ...sessionSummary(session),
    model: getSessionModel(session.answers, session.paperId),
    questions: session.answers.map((answer) => ({
      sortOrder: answer.sortOrder,
      ...toQuestionDto(answer.question, includeAnswer),
    })),
    userAnswers: session.answers.map((answer) => ({
      questionId: answer.questionId,
      answer: answer.answer,
      isCorrect: answer.isCorrect,
      timeSpentSeconds: answer.timeSpentSeconds,
      answeredAt: answer.answeredAt?.toISOString() ?? null,
    })),
  };
}

export async function submitPracticeSession(
  user: AuthenticatedUser,
  sessionId: string,
  input: SubmitSessionInput
) {
  const now = new Date();
  const submitted = await prisma.$transaction(async (tx) => {
    const session = await tx.practiceSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
      include: {
        answers: {
          orderBy: { sortOrder: "asc" },
          include: {
            question: {
              include: {
                tag: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundError("练习不存在");
    }

    if (session.status !== "IN_PROGRESS") {
      throw new ConflictError("该练习已提交，不能重复提交");
    }

    const answerMap = new Map(input.answers.map((answer) => [answer.questionId, answer]));
    let answeredCount = 0;
    let correctCount = 0;

    const answerRows = session.answers.map((answerRow) => {
      const submittedAnswer = answerMap.get(answerRow.questionId);
      const answer = normalizeAnswer(submittedAnswer?.answer);
      const correctAnswer = normalizeAnswer(answerRow.question.correctAnswer);
      const isAnswered = answer.length > 0;
      const isCorrect = isAnswered && answer === correctAnswer;

      if (isAnswered) {
        answeredCount += 1;
      }

      if (isCorrect) {
        correctCount += 1;
      }

      return {
        questionId: answerRow.questionId,
        tagId: answerRow.question.tagId,
        sortOrder: answerRow.sortOrder,
        answer: isAnswered ? answer : null,
        correctAnswer,
        isCorrect: isAnswered ? isCorrect : false,
        timeSpentSeconds: submittedAnswer?.timeSpentSeconds ?? 0,
        analysisHtml: normalizeRichHtml(answerRow.question.analysisHtml),
      };
    });

    const totalCount = session.answers.length;
    const wrongCount = answeredCount - correctCount;
    const unansweredCount = totalCount - answeredCount;
    const accuracy = totalCount > 0 ? Number(((correctCount / totalCount) * 100).toFixed(2)) : 0;

    const savedAnswers = await Promise.all(
      answerRows.map((answer) =>
        tx.practiceAnswer.upsert({
          where: {
            sessionId_questionId: {
              sessionId: session.id,
              questionId: answer.questionId,
            },
          },
          update: {
            answer: answer.answer,
            isCorrect: answer.isCorrect,
            timeSpentSeconds: answer.timeSpentSeconds,
            answeredAt: answer.answer ? now : null,
            sortOrder: answer.sortOrder,
          },
          create: {
            sessionId: session.id,
            userId: user.id,
            questionId: answer.questionId,
            answer: answer.answer,
            isCorrect: answer.isCorrect,
            timeSpentSeconds: answer.timeSpentSeconds,
            answeredAt: answer.answer ? now : null,
            sortOrder: answer.sortOrder,
          },
        })
      )
    );

    await Promise.all(
      savedAnswers.map((savedAnswer, index) => {
        const answer = answerRows[index];

        if (!answer.answer) {
          return null;
        }

        if (!answer.isCorrect) {
          return tx.wrongQuestion.upsert({
            where: {
              userId_questionId: {
                userId: user.id,
                questionId: answer.questionId,
              },
            },
            update: {
              wrongCount: { increment: 1 },
              lastWrongAt: now,
              lastPracticeAnswerId: savedAnswer.id,
              tagId: answer.tagId,
              resolvedAt: null,
            },
            create: {
              userId: user.id,
              questionId: answer.questionId,
              tagId: answer.tagId,
              lastPracticeAnswerId: savedAnswer.id,
              lastWrongAt: now,
            },
          });
        }

        return tx.wrongQuestion.updateMany({
          where: {
            userId: user.id,
            questionId: answer.questionId,
            resolvedAt: null,
          },
          data: {
            resolvedAt: now,
            lastPracticeAnswerId: savedAnswer.id,
          },
        });
      })
    );

    const updatedSession = await tx.practiceSession.update({
      where: { id: session.id },
      data: {
        status: "SUBMITTED",
        answeredCount,
        correctCount,
        wrongCount,
        unansweredCount,
        accuracy,
        elapsedSeconds: input.elapsedSeconds,
        submittedAt: now,
      },
    });

    return {
      session: updatedSession,
      answers: answerRows,
    };
  });

  return {
    sessionId: submitted.session.id,
    title: submitted.session.title,
    totalCount: submitted.session.totalCount,
    answeredCount: submitted.session.answeredCount,
    correctCount: submitted.session.correctCount,
    wrongCount: submitted.session.wrongCount,
    unansweredCount: submitted.session.unansweredCount,
    accuracy: decimalToString(submitted.session.accuracy),
    elapsedSeconds: submitted.session.elapsedSeconds,
    answers: submitted.answers,
  };
}
