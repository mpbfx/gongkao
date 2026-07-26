import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { BusinessError, ConflictError, MembershipRequiredError, NotFoundError } from "@/server/services/errors";
import { hasActiveMembership } from "@/server/services/membership";
import {
  buildPracticeAnswerUpdate,
  buildTagStatsUpdate,
  buildWrongQuestionResolve,
  buildWrongQuestionUpdate,
  chunk,
  runWithWriteConflictRetry,
} from "@/server/services/practice-batch-writes";
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
    // 重开会话里上一轮已判分的题不接受改动，与提交时的锁定保持一致。
    const lockedQuestionIds = getPreviouslyGradedQuestionIds(session.sourceTagIdsJson);
    const changedAnswers = normalizePracticeProgressAnswers(
      input.answers.filter((answer) => !lockedQuestionIds.has(answer.questionId))
    );

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

/**
 * 提交是最关键的用户动作，不能被 Prisma 默认的 5 秒事务超时误伤：
 * 写已经折叠成个位数条语句，这里再留足余量兜底数据库抖动。
 */
const submitTransactionOptions = { timeout: 30_000, maxWait: 10_000 };

export async function submitPracticeSession(
  user: AuthenticatedUser,
  sessionId: string,
  input: SubmitSessionInput
) {
  const now = new Date();
  const submitted = await runWithWriteConflictRetry(() =>
    prisma.$transaction(async (tx) => {
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
    const previouslyGradedQuestionIds = getPreviouslyGradedQuestionIds(
      session.sourceTagIdsJson
    );
    // 重开的试卷会话里，上一轮已判分的题沿用历史作答：
    // 否则学员看过答案后重开，改答案即可刷高成绩。
    const effectiveAnswers = session.answers.map((answerRow) => {
      if (previouslyGradedQuestionIds.has(answerRow.questionId)) {
        return {
          questionId: answerRow.questionId,
          answer: answerRow.answer,
          timeSpentSeconds: answerRow.timeSpentSeconds,
          decisionNote: answerRow.decisionNote,
        };
      }

      const submitted = answerMap.get(answerRow.questionId);

      return {
        questionId: answerRow.questionId,
        answer: submitted?.answer ?? null,
        timeSpentSeconds: submitted?.timeSpentSeconds ?? 0,
        decisionNote: submitted?.decisionNote?.trim() || null,
      };
    });
    const effectiveByQuestionId = new Map(
      effectiveAnswers.map((answer) => [answer.questionId, answer])
    );
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
      effectiveAnswers
    );
    const evaluatedByQuestionId = new Map(
      evaluation.answers.map((answer) => [answer.questionId, answer])
    );
    const answerRows = session.answers.map((answerRow) => {
      const evaluated = evaluatedByQuestionId.get(answerRow.questionId);
      if (!evaluated) throw new ConflictError("练习题目评分失败");
      return {
        ...evaluated,
        answerId: answerRow.id,
        tagId: answerRow.question.tagId,
        sortOrder: answerRow.sortOrder,
        decisionNote: effectiveByQuestionId.get(answerRow.questionId)?.decisionNote ?? null,
        analysisHtml: normalizeRichHtml(answerRow.question.analysisHtml),
      };
    });
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

    // 作答行在建会话时已全部创建，这里按分片一条语句更新，
    // 不再逐题 upsert（135 题实测可省下六百多条 SQL）。
    for (const part of chunk(answerRows)) {
      await tx.$executeRaw(
        buildPracticeAnswerUpdate(
          session.id,
          part.map((answer) => ({
            questionId: answer.questionId,
            answer: answer.answer,
            isCorrect: answer.isCorrect,
            timeSpentSeconds: answer.timeSpentSeconds,
            decisionNote: answer.decisionNote,
            answeredAt: answer.answer ? now : null,
          })),
          now
        )
      );
    }

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

    if (tagRounds.size > 0) {
      // 按 tagId 排序：并发提交以相同顺序申请行锁，显著降低死锁概率。
      const statsWrites = Array.from(tagRounds, ([tagId, round]) => ({
        tagId,
        ...round,
        foundation:
          session.purpose === "FOUNDATION"
            ? {
                passed: evaluateFoundationRound({
                  totalCount,
                  correctCount: round.correctCount,
                }).passed,
                roundCorrect: round.correctCount,
              }
            : null,
      })).toSorted((first, second) => first.tagId.localeCompare(second.tagId));

      // 先用零值占位保证行存在，再统一走增量更新：
      // 「先查后建」在并发提交下会同时判定为不存在并撞唯一约束。
      await tx.userTagStats.createMany({
        data: statsWrites.map((stats) => ({ userId: user.id, tagId: stats.tagId })),
        skipDuplicates: true,
      });

      for (const part of chunk(statsWrites)) {
        await tx.$executeRaw(buildTagStatsUpdate(user.id, part, now));
      }
    }

    const gradedAnswers = answerRows.filter(
      (answer) => answer.answer && !previouslyGradedQuestionIds.has(answer.questionId)
    );
    // 同样按 questionId 排序，保证并发提交的加锁顺序一致。
    const wrongAnswers = gradedAnswers
      .filter((answer) => answer.isCorrect === false)
      .toSorted((first, second) => first.questionId.localeCompare(second.questionId));
    const correctQuestionIds = gradedAnswers
      .filter((answer) => answer.isCorrect === true)
      .map((answer) => answer.questionId)
      .toSorted((first, second) => first.localeCompare(second));

    if (wrongAnswers.length > 0) {
      // 与标签统计同理：零值占位 + 增量更新，避免并发下的唯一约束冲突。
      await tx.wrongQuestion.createMany({
        data: wrongAnswers.map((answer) => ({
          userId: user.id,
          questionId: answer.questionId,
          tagId: answer.tagId,
          wrongCount: 0,
          lastWrongAt: now,
        })),
        skipDuplicates: true,
      });

      for (const part of chunk(wrongAnswers)) {
        await tx.$executeRaw(
          buildWrongQuestionUpdate(
            user.id,
            part.map((answer) => ({
              questionId: answer.questionId,
              tagId: answer.tagId,
              lastPracticeAnswerId: answer.answerId,
            })),
            now
          )
        );
      }
    }

    // 本次答对即视为掌握，一条语句批量移出错题本。
    for (const part of chunk(correctQuestionIds)) {
      await tx.$executeRaw(buildWrongQuestionResolve(user.id, session.id, part, now));
    }

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

      return {
        session: updatedSession,
        answers: answerRows,
        sections: evaluation.sections,
      };
    }, submitTransactionOptions)
  );

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
