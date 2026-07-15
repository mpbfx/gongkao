import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { BusinessError, NotFoundError } from "@/server/services/errors";
import { createQuestionPracticeSession } from "@/server/services/practice";
import { getPracticeQuestionWhere } from "@/server/services/practice-question-policy";
import { listActiveTagsTree, type TagTreeNode } from "@/server/services/tags";

const FOUNDATION_COUNT = 15;

function flattenLeaves(nodes: TagTreeNode[]) {
  const leaves: TagTreeNode[] = [];
  function visit(node: TagTreeNode) {
    if (node.children.length === 0 || node.isLeaf) leaves.push(node);
    else node.children.forEach(visit);
  }
  nodes.forEach(visit);
  return leaves;
}

export async function getFoundationProgress(user: AuthenticatedUser) {
  const leaves = flattenLeaves(await listActiveTagsTree()).filter((tag) => !tag.isMaterialOnly);
  const questionWhere = await getPracticeQuestionWhere(user);
  const leafIds = leaves.map((tag) => tag.id);
  const [stats, questionGroups] = await Promise.all([
    prisma.userTagStats.findMany({
      where: { userId: user.id, tagId: { in: leafIds } },
      select: {
        tagId: true,
        foundationStatus: true,
        foundationRoundCount: true,
        lastRoundCorrect: true,
        bestRoundCorrect: true,
        passedAt: true,
      },
    }),
    prisma.question.groupBy({
      by: ["tagId"],
      where: {
        ...questionWhere,
        tagId: { in: leafIds },
      },
      _count: { _all: true },
    }),
  ]);
  const statsByTagId = new Map(stats.map((item) => [item.tagId, item]));
  const questionCountByTagId = new Map(
    questionGroups.flatMap((group) =>
      group.tagId ? [[group.tagId, group._count._all] as const] : []
    )
  );
  const items = leaves.map((tag) => {
    const item = statsByTagId.get(tag.id);
    const questionCount = questionCountByTagId.get(tag.id) ?? 0;
    const trainable = questionCount >= FOUNDATION_COUNT;
    return {
      tagId: tag.id,
      name: tag.name,
      path: tag.path ?? tag.name,
      questionCount,
      trainable,
      status: trainable ? (item?.foundationStatus ?? "NOT_STARTED") : "INSUFFICIENT",
      roundCount: item?.foundationRoundCount ?? 0,
      lastRoundCorrect: item?.lastRoundCorrect ?? null,
      bestRoundCorrect: item?.bestRoundCorrect ?? null,
      passedAt: item?.passedAt?.toISOString() ?? null,
    };
  });
  const trainableItems = items.filter((item) => item.trainable);
  const current = trainableItems.find((item) => item.status !== "PASSED") ?? null;

  return {
    totalCount: trainableItems.length,
    passedCount: trainableItems.filter((item) => item.status === "PASSED").length,
    trainingCount: trainableItems.filter((item) => item.status === "TRAINING").length,
    insufficientCount: items.filter((item) => !item.trainable).length,
    completed: trainableItems.length > 0 && trainableItems.every((item) => item.status === "PASSED"),
    current,
    items,
  };
}

export async function createFoundationPracticeSession(user: AuthenticatedUser, tagId: string) {
  const tag = await prisma.questionTag.findFirst({
    where: { id: tagId, isActive: true, isLeaf: true, isMaterialOnly: false },
    select: { id: true, name: true, path: true },
  });
  if (!tag) throw new NotFoundError("叶子题型不存在");

  const questionWhere = await getPracticeQuestionWhere(user);
  const questions = await prisma.question.findMany({
    where: { tagId, ...questionWhere },
    include: {
      material: { select: { id: true, title: true, contentHtml: true } },
      tag: { select: { id: true, name: true } },
      options: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (questions.length < FOUNDATION_COUNT) {
    throw new BusinessError(`该题型当前只有 ${questions.length} 道题，达到 15 道后可开始筑基训练`);
  }

  const history = await prisma.practiceAnswer.findMany({
    where: { userId: user.id, questionId: { in: questions.map((question) => question.id) } },
    orderBy: { createdAt: "desc" },
    select: {
      questionId: true,
      isCorrect: true,
      createdAt: true,
      session: { select: { purpose: true, createdAt: true } },
    },
  });
  const recentFoundationSessions = await prisma.practiceSession.findMany({
    where: {
      userId: user.id,
      purpose: "FOUNDATION",
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { sourceTagIdsJson: true, answers: { select: { questionId: true } } },
  });
  const lastFoundation = recentFoundationSessions.find((session) => {
    if (!Array.isArray(session.sourceTagIdsJson)) return false;
    const source = session.sourceTagIdsJson[0];
    return Boolean(source && typeof source === "object" && !Array.isArray(source) && source.tagId === tagId);
  });
  const lastQuestionIds = new Set(lastFoundation?.answers.map((answer) => answer.questionId) ?? []);
  const historyByQuestionId = new Map<
    string,
    { seen: boolean; everWrong: boolean; lastSeenAt: number }
  >();
  for (const answer of history) {
    const current = historyByQuestionId.get(answer.questionId) ?? {
      seen: false,
      everWrong: false,
      lastSeenAt: 0,
    };
    current.seen = true;
    current.everWrong ||= answer.isCorrect === false;
    current.lastSeenAt = Math.max(current.lastSeenAt, answer.createdAt.getTime());
    historyByQuestionId.set(answer.questionId, current);
  }

  function rank(questionId: string) {
    const item = historyByQuestionId.get(questionId);
    if (!item?.seen) return 0;
    if (item.everWrong) return 1;
    return 2;
  }
  const sorted = questions
    .map((question) => ({ question, random: Math.random() }))
    .toSorted((first, second) => {
      const lastRoundDifference = Number(lastQuestionIds.has(first.question.id)) - Number(lastQuestionIds.has(second.question.id));
      if (lastRoundDifference !== 0) return lastRoundDifference;
      const rankDifference = rank(first.question.id) - rank(second.question.id);
      if (rankDifference !== 0) return rankDifference;
      const firstSeen = historyByQuestionId.get(first.question.id)?.lastSeenAt ?? 0;
      const secondSeen = historyByQuestionId.get(second.question.id)?.lastSeenAt ?? 0;
      return firstSeen - secondSeen || first.random - second.random;
    })
    .slice(0, FOUNDATION_COUNT)
    .map((item) => item.question);

  return createQuestionPracticeSession({
    user,
    mode: "SPECIAL",
    purpose: "FOUNDATION",
    title: `筑基训练：${tag.name}`,
    questions: sorted,
    sourceTagIdsJson: [{ tagId, num: FOUNDATION_COUNT }],
  });
}
