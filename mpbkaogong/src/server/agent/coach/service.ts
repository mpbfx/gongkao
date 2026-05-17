import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { getCoachConfig } from "@/server/agent/shared/config";
import { generateStructuredResponse } from "@/server/agent/shared/llm";
import {
  agentRecommendationActionSchema,
  agentRecommendationDtoSchema,
  coachDiagnosisDtoSchema,
  type AgentRecommendationAction,
  type AgentRecommendationDto,
  type CoachConfig,
  type CoachDiagnosisDto,
} from "@/server/agent/shared/schemas";
import { createDailyPracticeSession } from "@/server/services/daily-practice";
import { NotFoundError } from "@/server/services/errors";
import { sessionSummary } from "@/server/services/practice";
import { createSpecialPracticeSession } from "@/server/services/special-practice";
import { createWrongQuestionPracticeSession } from "@/server/services/wrong-questions";
import {
  buildDraftRecommendations,
  type DraftRecommendation,
  type TagMetric,
} from "@/server/agent/coach/recommendation-engine";

type CoachGraphInput = {
  user: AuthenticatedUser;
  sourceSessionId?: string;
};

type CoachContext = {
  metrics: TagMetric[];
  totalSessions: number;
  recentDaysSessions: number;
  totalAnswers: number;
  overallAverageTimeSeconds: number;
};

const CoachState = Annotation.Root({
  input: Annotation<CoachGraphInput>(),
  config: Annotation<CoachConfig | undefined>(),
  context: Annotation<CoachContext | undefined>(),
  drafts: Annotation<DraftRecommendation[] | undefined>(),
  diagnosis: Annotation<Omit<CoachDiagnosisDto, "recommendations"> | undefined>(),
});

const coachSummaryOutputSchema = z.object({
  title: z.string(),
  evidence: z.array(z.string()).min(1).max(3),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

function evidenceFromJson(value: unknown) {
  const parsed = z.array(z.string()).safeParse(value);

  return parsed.success ? parsed.data : [];
}

function toRecommendationDto(row: {
  id: string;
  type: string;
  title: string;
  evidenceJson: unknown;
  actionJson: unknown;
  confidence: string;
  status: string;
  clickedAt: Date | null;
  startedSessionId: string | null;
  completedAt: Date | null;
}): AgentRecommendationDto {
  return agentRecommendationDtoSchema.parse({
    id: row.id,
    type: row.type,
    title: row.title,
    evidence: evidenceFromJson(row.evidenceJson),
    action: agentRecommendationActionSchema.parse(row.actionJson),
    confidence: row.confidence,
    status: row.status,
    clickedAt: row.clickedAt?.toISOString() ?? null,
    startedSessionId: row.startedSessionId,
    completedAt: row.completedAt?.toISOString() ?? null,
  });
}

async function getExistingRecommendations(user: AuthenticatedUser, sourceSessionId: string) {
  const rows = await prisma.agentRecommendation.findMany({
    where: {
      userId: user.id,
      sourceSessionId,
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map(toRecommendationDto);
}

function mergeMetric(
  metrics: Map<string, TagMetric>,
  input: {
    tagId: string | null;
    tagName: string;
    isCorrect: boolean;
    timeSpentSeconds: number;
  }
) {
  const key = input.tagId ?? "untagged";
  const current =
    metrics.get(key) ??
    ({
      tagId: input.tagId,
      tagName: input.tagName,
      answeredCount: 0,
      correctCount: 0,
      wrongCount: 0,
      totalTimeSeconds: 0,
      unresolvedWrongCount: 0,
    } satisfies TagMetric);

  current.answeredCount += 1;
  current.correctCount += input.isCorrect ? 1 : 0;
  current.wrongCount += input.isCorrect ? 0 : 1;
  current.totalTimeSeconds += input.timeSpentSeconds;
  metrics.set(key, current);
}

async function loadCoachContext(user: AuthenticatedUser, config: CoachConfig, sourceSessionId?: string) {
  const cutoff = new Date(Date.now() - config.recentDays * 24 * 60 * 60 * 1000);
  const sourceSessionWhere = sourceSessionId
    ? {
        id: sourceSessionId,
        userId: user.id,
        status: "SUBMITTED" as const,
      }
    : null;

  if (sourceSessionWhere) {
    const sourceSession = await prisma.practiceSession.findFirst({
      where: sourceSessionWhere,
      select: { id: true },
    });

    if (!sourceSession) {
      throw new NotFoundError("练习记录不存在");
    }
  }

  const [sessions, recentDaysSessions, wrongQuestions] = await Promise.all([
    prisma.practiceSession.findMany({
      where: {
        userId: user.id,
        status: "SUBMITTED",
        ...(sourceSessionId ? { id: sourceSessionId } : {}),
      },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      take: sourceSessionId ? 1 : config.recentSessionLimit,
      include: {
        answers: {
          include: {
            question: {
              select: {
                tagId: true,
                tag: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.practiceSession.count({
      where: {
        userId: user.id,
        status: "SUBMITTED",
        submittedAt: { gte: cutoff },
      },
    }),
    prisma.wrongQuestion.findMany({
      where: {
        userId: user.id,
        resolvedAt: null,
      },
      select: {
        tagId: true,
        tag: { select: { id: true, name: true } },
        question: {
          select: {
            tagId: true,
            tag: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  const metrics = new Map<string, TagMetric>();
  let totalAnswers = 0;
  let totalTimeSeconds = 0;

  for (const session of sessions) {
    for (const answer of session.answers) {
      if (!answer.answer) {
        continue;
      }

      const tagId = answer.question.tag?.id ?? answer.question.tagId ?? null;
      const tagName = answer.question.tag?.name ?? "未分类";
      const timeSpentSeconds = answer.timeSpentSeconds ?? 0;

      totalAnswers += 1;
      totalTimeSeconds += timeSpentSeconds;
      mergeMetric(metrics, {
        tagId,
        tagName,
        isCorrect: answer.isCorrect === true,
        timeSpentSeconds,
      });
    }
  }

  for (const wrongQuestion of wrongQuestions) {
    const tagId = wrongQuestion.tag?.id ?? wrongQuestion.question.tag?.id ?? wrongQuestion.tagId ?? wrongQuestion.question.tagId ?? null;
    const key = tagId ?? "untagged";
    const current =
      metrics.get(key) ??
      ({
        tagId,
        tagName: wrongQuestion.tag?.name ?? wrongQuestion.question.tag?.name ?? "未分类",
        answeredCount: 0,
        correctCount: 0,
        wrongCount: 0,
        totalTimeSeconds: 0,
        unresolvedWrongCount: 0,
      } satisfies TagMetric);

    current.unresolvedWrongCount += 1;
    metrics.set(key, current);
  }

  return {
    metrics: Array.from(metrics.values()),
    totalSessions: sessions.length,
    recentDaysSessions,
    totalAnswers,
    overallAverageTimeSeconds: totalAnswers > 0 ? totalTimeSeconds / totalAnswers : 0,
  } satisfies CoachContext;
}

function fallbackDiagnosis(
  context: CoachContext,
  config: CoachConfig,
  drafts: DraftRecommendation[],
  sourceSessionId?: string
): Omit<CoachDiagnosisDto, "recommendations"> {
  const first = drafts[0];

  return {
    summary: {
      title: first ? first.title : "先积累一次有效练习",
      totalSessions: context.totalSessions,
      totalAnswers: context.totalAnswers,
      recentSessionLimit: config.recentSessionLimit,
      recentDays: config.recentDays,
      sourceSessionId: sourceSessionId ?? null,
    },
    evidence: first?.evidence ?? ["当前数据不足，完成练习后再诊断会更准确"],
    confidence: first?.confidence ?? "LOW",
    configSnapshot: config,
  };
}

async function explainDiagnosis(
  context: CoachContext,
  config: CoachConfig,
  drafts: DraftRecommendation[],
  sourceSessionId?: string
) {
  const fallback = fallbackDiagnosis(context, config, drafts, sourceSessionId);

  return generateStructuredResponse({
    schema: coachSummaryOutputSchema,
    name: "coach_diagnosis_summary",
    instructions:
      "你是公考题库的学习教练。只基于给定统计数据给出简短、克制、可执行的诊断。不要承诺提分，不要编造不存在的数据。",
    input: JSON.stringify({
      context,
      recommendations: drafts,
      config,
    }),
    fallback: {
      title: fallback.summary.title,
      evidence: fallback.evidence.slice(0, 3),
      confidence: fallback.confidence,
    },
  }).then((output) => ({
    ...fallback,
    summary: {
      ...fallback.summary,
      title: output.title,
    },
    evidence: output.evidence,
    confidence: output.confidence,
  }));
}

async function runCoachGraph(input: CoachGraphInput) {
  const graph = new StateGraph(CoachState)
    .addNode("load_config", async () => ({
      config: await getCoachConfig(),
    }))
    .addNode("load_context", async (state) => {
      if (!state.config) {
        throw new Error("Coach config was not loaded.");
      }

      return {
        context: await loadCoachContext(state.input.user, state.config, state.input.sourceSessionId),
      };
    })
    .addNode("rank", async (state) => {
      if (!state.context || !state.config) {
        throw new Error("Coach context was not loaded.");
      }

      return {
        drafts: buildDraftRecommendations({
          metrics: state.context.metrics,
          config: state.config,
          overallAverageTimeSeconds: state.context.overallAverageTimeSeconds,
        }),
      };
    })
    .addNode("explain", async (state) => {
      if (!state.context || !state.config || !state.drafts) {
        throw new Error("Coach draft recommendations were not loaded.");
      }

      return {
        diagnosis: await explainDiagnosis(
          state.context,
          state.config,
          state.drafts,
          state.input.sourceSessionId
        ),
      };
    })
    .addEdge(START, "load_config")
    .addEdge("load_config", "load_context")
    .addEdge("load_context", "rank")
    .addEdge("rank", "explain")
    .addEdge("explain", END)
    .compile();

  const state = await graph.invoke({ input });

  if (!state.config || !state.drafts || !state.diagnosis) {
    throw new Error("Coach graph did not produce a diagnosis.");
  }

  return {
    config: state.config,
    drafts: state.drafts,
    diagnosis: state.diagnosis,
  };
}

async function persistRecommendations({
  user,
  sourceSessionId,
  config,
  drafts,
}: {
  user: AuthenticatedUser;
  sourceSessionId?: string;
  config: CoachConfig;
  drafts: DraftRecommendation[];
}) {
  const rows = await Promise.all(
    drafts.map((draft) =>
      prisma.agentRecommendation.create({
        data: {
          userId: user.id,
          sourceSessionId,
          type: draft.type,
          title: draft.title,
          configSnapshotJson: config as Prisma.InputJsonValue,
          evidenceJson: draft.evidence as Prisma.InputJsonValue,
          actionJson: draft.action as Prisma.InputJsonValue,
          confidence: draft.confidence,
        },
      })
    )
  );

  return rows.map(toRecommendationDto);
}

export async function getRecentCoachDiagnosis(user: AuthenticatedUser) {
  const result = await runCoachGraph({ user });
  const recommendations = await persistRecommendations({
    user,
    config: result.config,
    drafts: result.drafts,
  });

  return coachDiagnosisDtoSchema.parse({
    ...result.diagnosis,
    recommendations,
  });
}

export async function getSessionCoachDiagnosis(user: AuthenticatedUser, sessionId: string) {
  const existingRecommendations = await getExistingRecommendations(user, sessionId);

  if (existingRecommendations.length > 0) {
    const config = await getCoachConfig();
    const context = await loadCoachContext(user, config, sessionId);
    const fallback = fallbackDiagnosis(
      context,
      config,
      existingRecommendations.map((recommendation) => ({
        type: recommendation.type,
        title: recommendation.title,
        evidence: recommendation.evidence,
        action: recommendation.action,
        confidence: recommendation.confidence,
      })),
      sessionId
    );

    return coachDiagnosisDtoSchema.parse({
      ...fallback,
      recommendations: existingRecommendations,
    });
  }

  const result = await runCoachGraph({ user, sourceSessionId: sessionId });
  const recommendations = await persistRecommendations({
    user,
    sourceSessionId: sessionId,
    config: result.config,
    drafts: result.drafts,
  });

  return coachDiagnosisDtoSchema.parse({
    ...result.diagnosis,
    recommendations,
  });
}

async function getStartedSessionSummary(user: AuthenticatedUser, sessionId: string) {
  const session = await prisma.practiceSession.findFirst({
    where: {
      id: sessionId,
      userId: user.id,
    },
  });

  if (!session) {
    throw new NotFoundError("推荐练习不存在");
  }

  return sessionSummary(session);
}

async function createSessionFromAction(user: AuthenticatedUser, action: AgentRecommendationAction) {
  if (action.type === "SPECIAL_PRACTICE") {
    return createSpecialPracticeSession(user, {
      reqs: [{ tagId: action.tagId, num: action.count }],
      difficulty: action.difficulty ?? null,
    });
  }

  if (action.type === "WRONG_PRACTICE" || action.type === "WRONG_MEMORIZE") {
    return createWrongQuestionPracticeSession(user, {
      mode: action.type === "WRONG_MEMORIZE" ? "MEMORIZE" : "WRONG",
      tagId: action.tagId ?? undefined,
      count: action.count,
    });
  }

  return createDailyPracticeSession(user, {
    date: action.date,
  });
}

export async function startAgentRecommendation(user: AuthenticatedUser, recommendationId: string) {
  const recommendation = await prisma.agentRecommendation.findFirst({
    where: {
      id: recommendationId,
      userId: user.id,
    },
  });

  if (!recommendation) {
    throw new NotFoundError("推荐不存在");
  }

  if (recommendation.startedSessionId) {
    return {
      recommendation: toRecommendationDto(recommendation),
      session: await getStartedSessionSummary(user, recommendation.startedSessionId),
    };
  }

  const action = agentRecommendationActionSchema.parse(recommendation.actionJson);
  await prisma.agentRecommendation.update({
    where: { id: recommendation.id },
    data: {
      status: "CLICKED",
      clickedAt: new Date(),
    },
  });
  const createdSession = await createSessionFromAction(user, action);
  const updatedRecommendation = await prisma.agentRecommendation.update({
    where: { id: recommendation.id },
    data: {
      status: "STARTED",
      startedSessionId: createdSession.id,
    },
  });

  return {
    recommendation: toRecommendationDto(updatedRecommendation),
    session: createdSession,
  };
}

export async function completeRecommendationsForSession(userId: string, sessionId: string) {
  await prisma.agentRecommendation.updateMany({
    where: {
      userId,
      startedSessionId: sessionId,
      completedAt: null,
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
}

