import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/server/services/errors";
import { decimalToString } from "@/server/services/questions";

function buildSectionMap(session: {
  paperId: string | null;
  answers: Array<{
    isCorrect: boolean | null;
    timeSpentSeconds: number;
    question: {
      tag: { name: string } | null;
      paperQuestions: Array<{ paperId: string; sectionName: string | null; score: unknown }>;
    };
  }>;
}) {
  const sections = new Map<
    string,
    { name: string; totalCount: number; correctCount: number; score: number; maxScore: number; elapsedSeconds: number }
  >();
  for (const answer of session.answers) {
    const paperQuestion = session.paperId
      ? answer.question.paperQuestions.find((item) => item.paperId === session.paperId)
      : null;
    const name = paperQuestion?.sectionName ?? answer.question.tag?.name ?? "综合";
    const maxScore = Number(paperQuestion?.score ?? 1);
    const current = sections.get(name) ?? {
      name,
      totalCount: 0,
      correctCount: 0,
      score: 0,
      maxScore: 0,
      elapsedSeconds: 0,
    };
    current.totalCount += 1;
    current.correctCount += answer.isCorrect ? 1 : 0;
    current.score += answer.isCorrect ? maxScore : 0;
    current.maxScore += maxScore;
    current.elapsedSeconds += answer.timeSpentSeconds;
    sections.set(name, current);
  }
  return new Map(
    Array.from(sections.values()).map((section) => [
      section.name,
      {
        ...section,
        accuracy: section.totalCount > 0 ? Number(((section.correctCount / section.totalCount) * 100).toFixed(2)) : 0,
      },
    ])
  );
}

function eventCounts(events: Array<{ type: string }>) {
  return events.reduce<Record<string, number>>((counts, event) => {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
    return counts;
  }, {});
}

const sessionInclude = {
  answers: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      question: {
        include: {
          tag: { select: { name: true } },
          paperQuestions: { select: { paperId: true, sectionName: true, score: true } },
        },
      },
    },
  },
  events: { select: { type: true } },
};

export async function getPracticeComparison(user: AuthenticatedUser, sessionId: string) {
  const [current, goal] = await Promise.all([
    prisma.practiceSession.findFirst({
      where: { id: sessionId, userId: user.id, status: "SUBMITTED" },
      include: sessionInclude,
    }),
    prisma.userExamGoal.findUnique({
      where: { userId: user.id },
      select: { baselineSessionId: true },
    }),
  ]);
  if (!current) throw new NotFoundError("练习记录不存在");
  if (!goal?.baselineSessionId || goal.baselineSessionId === current.id) return null;

  const baseline = await prisma.practiceSession.findFirst({
    where: { id: goal.baselineSessionId, userId: user.id, status: "SUBMITTED" },
    include: sessionInclude,
  });
  if (!baseline) return null;

  const baselineSections = buildSectionMap(baseline);
  const currentSections = buildSectionMap(current);
  const sectionNames = Array.from(new Set([...baselineSections.keys(), ...currentSections.keys()]));
  const baselineEvents = eventCounts(baseline.events);
  const currentEvents = eventCounts(current.events);
  const scoreDelta = Number(current.score ?? 0) - Number(baseline.score ?? 0);
  const elapsedDelta = current.elapsedSeconds - baseline.elapsedSeconds;
  const improvements: string[] = [];

  if (scoreDelta > 0) improvements.push(`总分提高 ${scoreDelta.toFixed(2)} 分`);
  if (scoreDelta >= 0 && elapsedDelta < 0) improvements.push(`在得分未下降的情况下节省 ${Math.abs(elapsedDelta)} 秒`);
  if (current.unansweredCount < baseline.unansweredCount) improvements.push(`未答题减少 ${baseline.unansweredCount - current.unansweredCount} 道`);
  if ((currentEvents.RETURN ?? 0) < (baselineEvents.RETURN ?? 0)) improvements.push("重复返回题目的次数减少");
  for (const name of sectionNames) {
    const before = baselineSections.get(name)?.accuracy ?? 0;
    const after = currentSections.get(name)?.accuracy ?? 0;
    if (after > before) improvements.push(`${name}正确率提高 ${(after - before).toFixed(2)} 个百分点`);
  }

  return {
    baseline: {
      id: baseline.id,
      title: baseline.title,
      score: decimalToString(baseline.score),
      maxScore: decimalToString(baseline.maxScore),
      accuracy: decimalToString(baseline.accuracy),
      elapsedSeconds: baseline.elapsedSeconds,
      unansweredCount: baseline.unansweredCount,
      pauseCount: baseline.pauseCount,
      pausedSeconds: baseline.pausedSeconds,
      reflectionText: baseline.reflectionText,
      events: baselineEvents,
    },
    current: {
      id: current.id,
      title: current.title,
      score: decimalToString(current.score),
      maxScore: decimalToString(current.maxScore),
      accuracy: decimalToString(current.accuracy),
      elapsedSeconds: current.elapsedSeconds,
      unansweredCount: current.unansweredCount,
      pauseCount: current.pauseCount,
      pausedSeconds: current.pausedSeconds,
      reflectionText: current.reflectionText,
      events: currentEvents,
    },
    delta: {
      score: Number(scoreDelta.toFixed(2)),
      elapsedSeconds: elapsedDelta,
      accuracy: Number((Number(current.accuracy ?? 0) - Number(baseline.accuracy ?? 0)).toFixed(2)),
    },
    sections: sectionNames.map((name) => ({
      name,
      baseline: baselineSections.get(name) ?? null,
      current: currentSections.get(name) ?? null,
    })),
    improvements,
  };
}
