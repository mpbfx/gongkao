import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { BusinessError, ConflictError, MembershipRequiredError, NotFoundError } from "@/server/services/errors";
import { hasActiveMembership } from "@/server/services/membership";
import { evaluateFoundationRound, evaluatePracticeAnswers } from "@/server/services/practice-evaluation";
import {
  getPreviouslyGradedQuestionIds,
  normalizePracticeProgressAnswers,
} from "@/server/services/practice-progress";
import { getPracticeDeadline, normalizeSubmittedTiming } from "@/server/services/practice-timing";
import { assertPracticeQuestionsAccessible } from "@/server/services/practice-question-policy";
import { validateSubmittedQuestionIds } from "@/server/services/practice-submission";
import { toPaperModel } from "@/server/services/papers";
import {
  decimalToString,
  normalizeRichHtml,
  toQuestionDto,
} from "@/server/services/questions";

const practicePurposeSchema = z.enum([
  "PRACTICE",
  "BASELINE",
  "FOUNDATION",
  "MOCK",
  "TIME_PRESSURE",
  "WRONG_REVIEW",
]);
const practiceTimingModeSchema = z.enum(["UNTYPED", "STRICT", "FLEXIBLE"]);
const practiceEventTypeSchema = z.enum([
  "QUESTION_VIEW",
  "ANSWER_CHANGE",
  "SKIP",
  "RETURN",
  "PAUSE",
  "RESUME",
  "TIME_EXPIRED",
]);

export const createPaperSessionSchema = z.object({
  paperId: z.string().min(1),
  continueFromSessionId: z.string().min(1).optional(),
  mode: z.literal("PAPER").optional(),
  purpose: practicePurposeSchema.exclude(["FOUNDATION", "WRONG_REVIEW"]).default("PRACTICE"),
  timingMode: practiceTimingModeSchema.default("UNTYPED"),
  timeLimitSeconds: z.coerce.number().int().min(600).max(18_000).nullish(),
});

export const submitSessionSchema = z.object({
  elapsedSeconds: z.coerce.number().int().min(0).default(0),
  pauseCount: z.coerce.number().int().min(0).default(0),
  pausedSeconds: z.coerce.number().int().min(0).default(0),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.string().trim().nullable().optional(),
        timeSpentSeconds: z.coerce.number().int().min(0).default(0),
        decisionNote: z.string().trim().max(500).nullable().optional(),
      })
    )
    .default([]),
  events: z
    .array(
      z.object({
        questionId: z.string().min(1).nullable().optional(),
        type: practiceEventTypeSchema,
        occurredAt: z.coerce.date(),
        payload: z.record(z.string(), z.unknown()).nullable().optional(),
      })
    )
    .max(5000)
    .default([]),
});

export const saveSessionProgressSchema = submitSessionSchema.omit({ events: true });

export type SubmitSessionInput = z.infer<typeof submitSessionSchema>;
export type CreatePaperSessionInput = z.infer<typeof createPaperSessionSchema>;

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

function paperQuestionForAnswer(
  answer: {
    question: {
      tag?: { name: string } | null;
      paperQuestions?: Array<{
        paperId: string;
        sectionName: string | null;
        sortOrder: number;
      }>;
    };
  },
  paperId?: string | null
) {
  if (!paperId) {
    return null;
  }

  return answer.question.paperQuestions?.find((item) => item.paperId === paperId) ?? null;
}

function sectionNameForAnswer(
  answer: {
    question: {
      tag?: { name: string } | null;
      paperQuestions?: Array<{
        paperId: string;
        sectionName: string | null;
        sortOrder: number;
      }>;
    };
  },
  paperId?: string | null
) {
  const paperQuestion = paperQuestionForAnswer(answer, paperId);

  return paperQuestion?.sectionName ?? answer.question.tag?.name ?? "综合";
}

export function sessionSummary(session: {
  id: string;
  title: string;
  mode: string;
  status: string;
  purpose?: string;
  timingMode?: string;
  totalCount: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  elapsedSeconds: number;
  timeLimitSeconds?: number | null;
  pauseCount?: number;
  pausedSeconds?: number;
  score?: unknown;
  maxScore?: unknown;
  reflectionText?: string | null;
  accuracy?: unknown;
  submittedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  paperId?: string | null;
}) {
  const deadline = getPracticeDeadline({
    createdAt: session.createdAt,
    timingMode: session.timingMode ?? "UNTYPED",
    timeLimitSeconds: session.timeLimitSeconds,
  });

  return {
    id: session.id,
    title: session.title,
    mode: session.mode,
    status: session.status,
    purpose: session.purpose ?? "PRACTICE",
    timingMode: session.timingMode ?? "UNTYPED",
    totalCount: session.totalCount,
    answeredCount: session.answeredCount,
    correctCount: session.correctCount,
    wrongCount: session.wrongCount,
    unansweredCount: session.unansweredCount,
    elapsedSeconds: session.elapsedSeconds,
    timeLimitSeconds: session.timeLimitSeconds ?? null,
    deadlineAt: deadline?.toISOString() ?? null,
    serverNow: new Date().toISOString(),
    pauseCount: session.pauseCount ?? 0,
    pausedSeconds: session.pausedSeconds ?? 0,
    score: decimalToString(session.score),
    maxScore: decimalToString(session.maxScore),
    reflectionText: session.reflectionText ?? null,
    accuracy: decimalToString(session.accuracy),
    submittedAt: session.submittedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
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
  purpose = "PRACTICE",
}: {
  user: AuthenticatedUser;
  mode: "SPECIAL" | "DAILY" | "WRONG" | "MEMORIZE";
  title: string;
  questions: QuestionForSession[];
  sourceTagIdsJson?: Prisma.InputJsonValue;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | "UNKNOWN" | null;
  purpose?: "PRACTICE" | "FOUNDATION" | "WRONG_REVIEW";
}) {
  const session = await prisma.practiceSession.create({
    data: {
      userId: user.id,
      mode,
      status: "IN_PROGRESS",
      purpose,
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

export async function createPaperPracticeSession(
  user: AuthenticatedUser,
  input: CreatePaperSessionInput
) {
  if (input.purpose === "BASELINE" && !input.continueFromSessionId) {
    const existing = await prisma.practiceSession.findFirst({
      where: { userId: user.id, purpose: "BASELINE", status: "IN_PROGRESS" },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return getPracticeSessionDetail(user, existing.id);
  }

  const paperId = input.paperId;
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

  if (paper.isVipOnly && !(await hasActiveMembership(user.id, user.role))) {
    throw new MembershipRequiredError("该试卷需要会员权限");
  }
  await assertPracticeQuestionsAccessible(
    user,
    paper.questions.map((paperQuestion) => paperQuestion.question)
  );

  if (input.continueFromSessionId) {
    const continuationSource = await prisma.practiceSession.findFirst({
      where: {
        id: input.continueFromSessionId,
        userId: user.id,
        paperId: paper.id,
        mode: "PAPER",
        status: "SUBMITTED",
      },
      select: {
        id: true,
        answeredCount: true,
        totalCount: true,
        submittedAt: true,
        answers: {
          where: { answer: { not: null } },
          select: { questionId: true },
        },
      },
    });
    if (!continuationSource) {
      throw new NotFoundError("未找到可继续的历史练习");
    }
    if (continuationSource.answeredCount >= continuationSource.totalCount) {
      throw new ConflictError("这套试卷已经全部作答，可选择再练一次");
    }

    await prisma.$transaction(async (tx) => {
      await tx.practiceSession.updateMany({
        where: {
          userId: user.id,
          paperId: paper.id,
          mode: "PAPER",
          status: "IN_PROGRESS",
          id: { not: continuationSource.id },
        },
        data: { status: "ABANDONED" },
      });
      await tx.practiceSession.update({
        where: { id: continuationSource.id },
        data: {
          status: "IN_PROGRESS",
          timingMode: "UNTYPED",
          timeLimitSeconds: null,
          submittedAt: null,
          sourceTagIdsJson: {
            reopenedSubmission: {
              submittedAt: continuationSource.submittedAt?.toISOString() ?? null,
              gradedQuestionIds: continuationSource.answers.map(
                (answer) => answer.questionId
              ),
            },
          },
        },
      });
    });

    return {
      ...(await getPracticeSessionDetail(user, continuationSource.id)),
      resumed: true,
    };
  }

  const timeLimitSeconds = input.timingMode === "UNTYPED"
    ? null
    : (input.timeLimitSeconds ?? paper.durationSeconds);
  if (input.timingMode !== "UNTYPED" && !timeLimitSeconds) {
    throw new BusinessError("该试卷尚未配置时限，请先设置本次练习时长");
  }

  const activeSession = await prisma.practiceSession.findFirst({
    where: {
      userId: user.id,
      paperId: paper.id,
      mode: "PAPER",
      purpose: input.purpose,
      status: "IN_PROGRESS",
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (activeSession) {
    return {
      ...(await getPracticeSessionDetail(user, activeSession.id)),
      resumed: true,
    };
  }

  const session = await prisma.practiceSession.create({
    data: {
      userId: user.id,
      mode: "PAPER",
      status: "IN_PROGRESS",
      purpose: input.purpose,
      timingMode: input.timingMode,
      timeLimitSeconds,
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
    resumed: false,
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

export async function savePracticeSessionProgress(
  user: AuthenticatedUser,
  sessionId: string,
  input: z.infer<typeof saveSessionProgressSchema>
) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const session = await tx.practiceSession.findFirst({
      where: { id: sessionId, userId: user.id },
      include: {
        answers: { select: { questionId: true } },
      },
    });
    if (!session) throw new NotFoundError("练习不存在");
    if (session.status !== "IN_PROGRESS") {
      throw new ConflictError("该练习已提交，不能继续保存");
    }

    const sessionQuestionIds = new Set(session.answers.map((answer) => answer.questionId));
    if (input.answers.some((answer) => !sessionQuestionIds.has(answer.questionId))) {
      throw new ConflictError("进度包含本练习之外的题目");
    }
    const changedAnswers = normalizePracticeProgressAnswers(input.answers);

    await Promise.all(
      changedAnswers.map((answer) =>
        tx.practiceAnswer.update({
          where: {
            sessionId_questionId: {
              sessionId: session.id,
              questionId: answer.questionId,
            },
          },
          data: {
            answer: answer.answer,
            isCorrect: null,
            timeSpentSeconds: answer.timeSpentSeconds,
            decisionNote: answer.decisionNote,
            answeredAt: answer.answer ? now : null,
          },
        })
      )
    );

    const answeredCount = await tx.practiceAnswer.count({
      where: { sessionId: session.id, answer: { not: null } },
    });
    const updated = await tx.practiceSession.updateMany({
      where: { id: session.id, userId: user.id, status: "IN_PROGRESS" },
      data: {
        answeredCount,
        unansweredCount: session.totalCount - answeredCount,
        elapsedSeconds: input.elapsedSeconds,
        pauseCount: input.pauseCount,
        pausedSeconds: input.pausedSeconds,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictError("该练习已提交，不能继续保存");
    }

    return {
      sessionId: session.id,
      answeredCount,
      unansweredCount: session.totalCount - answeredCount,
      elapsedSeconds: input.elapsedSeconds,
      updatedAt: now.toISOString(),
    };
  });
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
      sectionName: sectionNameForAnswer(answer, session.paperId),
      ...toQuestionDto(answer.question, includeAnswer),
    })),
    userAnswers: session.answers.map((answer) => ({
      questionId: answer.questionId,
      answer: answer.answer,
      isCorrect: answer.isCorrect,
      timeSpentSeconds: answer.timeSpentSeconds,
      decisionNote: answer.decisionNote,
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
                tag: { select: { id: true, name: true } },
                paperQuestions: {
                  select: { paperId: true, sectionName: true, score: true },
                },
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

    const claimed = await tx.practiceSession.updateMany({
      where: {
        id: session.id,
        userId: user.id,
        status: "IN_PROGRESS",
      },
      data: { status: "SUBMITTED" },
    });
    if (claimed.count !== 1) {
      throw new ConflictError("该练习已提交，不能重复提交");
    }

    const sessionQuestionIds = new Set(session.answers.map((answer) => answer.questionId));
    const submittedQuestionIds = input.answers.map((answer) => answer.questionId);
    validateSubmittedQuestionIds({ sessionQuestionIds, submittedQuestionIds });
    if (input.events.some((event) => event.questionId && !sessionQuestionIds.has(event.questionId))) {
      throw new ConflictError("行为记录包含本练习之外的题目");
    }

    const answerMap = new Map(input.answers.map((answer) => [answer.questionId, answer]));
    const evaluation = evaluatePracticeAnswers(
      session.answers.map((answerRow) => {
        const paperQuestion = session.paperId
          ? answerRow.question.paperQuestions.find((item) => item.paperId === session.paperId)
          : null;
        return {
          questionId: answerRow.questionId,
          correctAnswer: answerRow.question.correctAnswer,
          score: paperQuestion?.score ? Number(paperQuestion.score) : 1,
          sectionName: paperQuestion?.sectionName ?? answerRow.question.tag?.name ?? "综合",
        };
      }),
      input.answers
    );
    const evaluatedByQuestionId = new Map(
      evaluation.answers.map((answer) => [answer.questionId, answer])
    );
    const answerRows = session.answers.map((answerRow) => {
      const submittedAnswer = answerMap.get(answerRow.questionId);
      const evaluated = evaluatedByQuestionId.get(answerRow.questionId);
      if (!evaluated) throw new ConflictError("练习题目评分失败");
      return {
        ...evaluated,
        tagId: answerRow.question.tagId,
        sortOrder: answerRow.sortOrder,
        decisionNote: submittedAnswer?.decisionNote?.trim() || null,
        analysisHtml: normalizeRichHtml(answerRow.question.analysisHtml),
      };
    });
    const previouslyGradedQuestionIds = getPreviouslyGradedQuestionIds(
      session.sourceTagIdsJson
    );
    const {
      totalCount,
      answeredCount,
      correctCount,
      wrongCount,
      unansweredCount,
      accuracy,
      score,
      maxScore,
    } = evaluation;

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
            decisionNote: answer.decisionNote,
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
            decisionNote: answer.decisionNote,
            answeredAt: answer.answer ? now : null,
            sortOrder: answer.sortOrder,
          },
        })
      )
    );

    if (input.events.length > 0) {
      await tx.practiceEvent.createMany({
        data: input.events.map((event) => ({
          sessionId: session.id,
          userId: user.id,
          questionId: event.questionId ?? null,
          type: event.type,
          payloadJson: event.payload as Prisma.InputJsonValue | undefined,
          occurredAt: event.occurredAt,
        })),
      });
    }

    const tagRounds = new Map<
      string,
      { answeredCount: number; correctCount: number; wrongCount: number }
    >();
    for (const answer of answerRows) {
      if (previouslyGradedQuestionIds.has(answer.questionId)) continue;
      if (!answer.tagId) continue;
      const group = tagRounds.get(answer.tagId) ?? {
        answeredCount: 0,
        correctCount: 0,
        wrongCount: 0,
      };
      group.answeredCount += answer.answer ? 1 : 0;
      group.correctCount += answer.answer && answer.isCorrect === true ? 1 : 0;
      group.wrongCount += answer.answer && answer.isCorrect === false ? 1 : 0;
      tagRounds.set(answer.tagId, group);
    }

    for (const [tagId, round] of tagRounds) {
      const previous = await tx.userTagStats.findUnique({
        where: { userId_tagId: { userId: user.id, tagId } },
      });
      const nextAnswered = (previous?.answeredCount ?? 0) + round.answeredCount;
      const nextCorrect = (previous?.correctCount ?? 0) + round.correctCount;
      const foundation = session.purpose === "FOUNDATION"
        ? evaluateFoundationRound({ totalCount, correctCount: round.correctCount })
        : null;
      const foundationData = foundation
        ? {
            foundationStatus: foundation.passed ? ("PASSED" as const) : ("TRAINING" as const),
            foundationRoundCount: (previous?.foundationRoundCount ?? 0) + 1,
            lastRoundCorrect: round.correctCount,
            bestRoundCorrect: Math.max(previous?.bestRoundCorrect ?? 0, round.correctCount),
            passedAt: foundation.passed ? (previous?.passedAt ?? now) : previous?.passedAt,
          }
        : {};

      await tx.userTagStats.upsert({
        where: { userId_tagId: { userId: user.id, tagId } },
        update: {
          answeredCount: nextAnswered,
          correctCount: nextCorrect,
          wrongCount: (previous?.wrongCount ?? 0) + round.wrongCount,
          accuracy: nextAnswered > 0 ? Number(((nextCorrect / nextAnswered) * 100).toFixed(2)) : null,
          lastPracticedAt: now,
          ...foundationData,
        },
        create: {
          userId: user.id,
          tagId,
          answeredCount: round.answeredCount,
          correctCount: round.correctCount,
          wrongCount: round.wrongCount,
          accuracy:
            round.answeredCount > 0
              ? Number(((round.correctCount / round.answeredCount) * 100).toFixed(2))
              : null,
          lastPracticedAt: now,
          ...foundationData,
        },
      });
    }

    await Promise.all(
      savedAnswers.map((savedAnswer, index) => {
        const answer = answerRows[index];

        if (previouslyGradedQuestionIds.has(answer.questionId)) {
          return null;
        }

        if (!answer.answer) {
          return null;
        }

        if (answer.isCorrect === false) {
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

    const timing = normalizeSubmittedTiming({
      createdAt: session.createdAt,
      timingMode: session.timingMode,
      timeLimitSeconds: session.timeLimitSeconds,
      elapsedSeconds: input.elapsedSeconds,
      pauseCount: input.pauseCount,
      pausedSeconds: input.pausedSeconds,
      now,
    });
    const updatedSession = await tx.practiceSession.update({
      where: { id: session.id },
      data: {
        status: "SUBMITTED",
        answeredCount,
        correctCount,
        wrongCount,
        unansweredCount,
        accuracy,
        elapsedSeconds: timing.elapsedSeconds,
        pauseCount: timing.pauseCount,
        pausedSeconds: timing.pausedSeconds,
        score,
        maxScore,
        submittedAt: now,
      },
    });

    if (session.purpose === "BASELINE") {
      await tx.userExamGoal.updateMany({
        where: { userId: user.id, baselineSessionId: null },
        data: { baselineSessionId: session.id },
      });
    }

    return {
      session: updatedSession,
      answers: answerRows,
      sections: evaluation.sections,
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
    pauseCount: submitted.session.pauseCount,
    pausedSeconds: submitted.session.pausedSeconds,
    score: decimalToString(submitted.session.score),
    maxScore: decimalToString(submitted.session.maxScore),
    answers: submitted.answers,
    sections: submitted.sections,
  };
}
