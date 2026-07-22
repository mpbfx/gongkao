import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  buildQuestionTagHierarchyUpdates,
  directQuestionLeafByRootName,
  fallbackParentNameByTagName,
  rootSortOrderByName,
  seedTagAssignments,
  tagAliasMerges,
} from "@/server/domain/question-tag-taxonomy";

type TransactionClient = Prisma.TransactionClient;

const taxonomyVersion = "normalized-v1";

function latestDate(first: Date | null, second: Date | null) {
  if (!first) return second;
  if (!second) return first;
  return first > second ? first : second;
}

function earliestDate(first: Date | null, second: Date | null) {
  if (!first) return second;
  if (!second) return first;
  return first < second ? first : second;
}

async function mergeTagStats(
  tx: TransactionClient,
  sourceTagId: string,
  targetTagId: string
) {
  const sourceStats = await tx.userTagStats.findMany({ where: { tagId: sourceTagId } });

  for (const source of sourceStats) {
    const target = await tx.userTagStats.findUnique({
      where: { userId_tagId: { userId: source.userId, tagId: targetTagId } },
    });

    if (!target) {
      await tx.userTagStats.update({
        where: { id: source.id },
        data: { tagId: targetTagId },
      });
      continue;
    }

    const answeredCount = target.answeredCount + source.answeredCount;
    const correctCount = target.correctCount + source.correctCount;
    const sourceIsNewer = source.updatedAt > target.updatedAt;
    const bestRoundCorrectValues = [
      target.bestRoundCorrect,
      source.bestRoundCorrect,
    ].filter((value): value is number => value !== null);

    await tx.userTagStats.update({
      where: { id: target.id },
      data: {
        answeredCount,
        correctCount,
        wrongCount: target.wrongCount + source.wrongCount,
        accuracy:
          answeredCount > 0
            ? Math.round((correctCount / answeredCount) * 10_000) / 100
            : null,
        lastPracticedAt: latestDate(target.lastPracticedAt, source.lastPracticedAt),
        foundationStatus:
          target.foundationStatus === "PASSED" || source.foundationStatus === "PASSED"
            ? "PASSED"
            : target.foundationStatus === "TRAINING" || source.foundationStatus === "TRAINING"
              ? "TRAINING"
              : "NOT_STARTED",
        foundationRoundCount:
          target.foundationRoundCount + source.foundationRoundCount,
        lastRoundCorrect: sourceIsNewer
          ? source.lastRoundCorrect
          : target.lastRoundCorrect,
        bestRoundCorrect:
          bestRoundCorrectValues.length > 0
            ? Math.max(...bestRoundCorrectValues)
            : null,
        passedAt: earliestDate(target.passedAt, source.passedAt),
      },
    });
    await tx.userTagStats.delete({ where: { id: source.id } });
  }
}

async function moveTagReferences(
  tx: TransactionClient,
  sourceTagId: string,
  targetTagId: string,
  options: { moveKnowledgeChunks: boolean }
) {
  await mergeTagStats(tx, sourceTagId, targetTagId);

  const questions = await tx.question.updateMany({
    where: { tagId: sourceTagId },
    data: { tagId: targetTagId },
  });
  const wrongQuestions = await tx.wrongQuestion.updateMany({
    where: { tagId: sourceTagId },
    data: { tagId: targetTagId },
  });
  const mistakeReviews = await tx.questionMistakeReview.updateMany({
    where: { tagId: sourceTagId },
    data: { tagId: targetTagId },
  });
  const knowledgeChunks = options.moveKnowledgeChunks
    ? await tx.knowledgeChunk.updateMany({
        where: { tagId: sourceTagId },
        data: { tagId: targetTagId },
      })
    : { count: 0 };

  return {
    questions: questions.count,
    wrongQuestions: wrongQuestions.count,
    mistakeReviews: mistakeReviews.count,
    knowledgeChunks: knowledgeChunks.count,
  };
}

function pickCanonicalRoot(
  tags: Array<{ id: string; name: string; slug: string; parentId: string | null }>,
  name: string
) {
  const candidates = tags.filter((tag) => tag.name === name && !tag.parentId);
  return (
    candidates.find((tag) => tag.slug.startsWith("saduck_tag_")) ??
    (candidates.length === 1 ? candidates[0] : undefined)
  );
}

export async function normalizeQuestionTagTaxonomy() {
  return prisma.$transaction(async (tx) => {
    const initialTags = await tx.questionTag.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, parentId: true },
    });
    const canonicalRoots = new Map(
      Array.from(rootSortOrderByName.keys()).flatMap((name) => {
        const root = pickCanonicalRoot(initialTags, name);
        return root ? [[name, root] as const] : [];
      })
    );
    let reparentedTags = 0;
    let normalizedSeedTags = 0;
    let mergedAliases = 0;
    const movedReferences = {
      questions: 0,
      wrongQuestions: 0,
      mistakeReviews: 0,
      knowledgeChunks: 0,
    };

    for (const [rootName, sortOrder] of rootSortOrderByName) {
      const root = canonicalRoots.get(rootName);
      if (!root) continue;
      await tx.questionTag.updateMany({
        where: {
          id: root.id,
          OR: [
            { sortOrder: { not: sortOrder } },
            { taxonomyVersion: { not: taxonomyVersion } },
            { taxonomyVersion: null },
          ],
        },
        data: { sortOrder, taxonomyVersion },
      });
    }

    for (const [tagName, parentName] of fallbackParentNameByTagName) {
      const parent = canonicalRoots.get(parentName);
      if (!parent) continue;
      const result = await tx.questionTag.updateMany({
        where: { name: tagName, parentId: null, id: { not: parent.id } },
        data: { parentId: parent.id, taxonomyVersion },
      });
      reparentedTags += result.count;
    }

    for (const assignment of seedTagAssignments) {
      const parent = canonicalRoots.get(assignment.parentName);
      if (!parent) continue;
      const result = await tx.questionTag.updateMany({
        where: {
          slug: assignment.slug,
          id: { not: parent.id },
          OR: [
            { name: { not: "未细分题目" } },
            { parentId: { not: parent.id } },
            { sortOrder: { not: 9990 } },
            { isActive: false },
          ],
        },
        data: {
          name: "未细分题目",
          parentId: parent.id,
          sortOrder: 9990,
          isActive: true,
          taxonomyVersion,
        },
      });
      normalizedSeedTags += result.count;
    }

    for (const [rootName, leaf] of directQuestionLeafByRootName) {
      const root = canonicalRoots.get(rootName);
      if (!root) continue;
      const target = await tx.questionTag.upsert({
        where: { id: leaf.id },
        update: {
          name: leaf.name,
          parentId: root.id,
          sortOrder: leaf.sortOrder,
          isActive: true,
          taxonomySource: "system",
          taxonomyVersion,
        },
        create: {
          ...leaf,
          parentId: root.id,
          depth: 1,
          path: `${rootName}/${leaf.name}`,
          isLeaf: true,
          isActive: true,
          taxonomySource: "system",
          taxonomyVersion,
        },
        select: { id: true },
      });
      const moved = await moveTagReferences(tx, root.id, target.id, {
        moveKnowledgeChunks: false,
      });
      for (const key of Object.keys(movedReferences) as Array<keyof typeof movedReferences>) {
        movedReferences[key] += moved[key];
      }
    }

    for (const alias of tagAliasMerges) {
      const source = await tx.questionTag.findFirst({
        where: { name: alias.sourceName, isActive: true },
        select: { id: true },
      });
      const target = await tx.questionTag.findFirst({
        where: { name: alias.targetName, isActive: true },
        select: { id: true },
      });
      if (!source || !target || source.id === target.id) continue;

      const moved = await moveTagReferences(tx, source.id, target.id, {
        moveKnowledgeChunks: true,
      });
      for (const key of Object.keys(movedReferences) as Array<keyof typeof movedReferences>) {
        movedReferences[key] += moved[key];
      }
      await tx.questionTag.updateMany({
        where: { parentId: source.id },
        data: { parentId: target.id, taxonomyVersion },
      });
      await tx.questionTag.update({
        where: { id: source.id },
        data: { isActive: false, taxonomyVersion },
      });
      mergedAliases += 1;
    }

    const activeTags = await tx.questionTag.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        parentId: true,
        depth: true,
        path: true,
        isLeaf: true,
        taxonomyVersion: true,
      },
    });
    const hierarchyUpdates = buildQuestionTagHierarchyUpdates(activeTags);
    const activeTagById = new Map(activeTags.map((tag) => [tag.id, tag]));
    let hierarchyUpdatedTags = 0;
    for (const update of hierarchyUpdates) {
      const current = activeTagById.get(update.id);
      if (
        current?.depth === update.depth &&
        current.path === update.path &&
        current.isLeaf === update.isLeaf &&
        current.taxonomyVersion === taxonomyVersion
      ) {
        continue;
      }
      const { id, ...hierarchy } = update;
      await tx.questionTag.update({
        where: { id },
        data: { ...hierarchy, taxonomyVersion },
      });
      hierarchyUpdatedTags += 1;
    }

    const activeRoots = hierarchyUpdates.filter((tag) => tag.depth === 0).length;
    const untaggedQuestions = await tx.question.count({
      where: { isActive: true, deletedAt: null, tagId: null },
    });

    return {
      activeRoots,
      activeTags: activeTags.length,
      untaggedQuestions,
      reparentedTags,
      normalizedSeedTags,
      mergedAliases,
      hierarchyUpdatedTags,
      movedReferences,
    };
  }, { maxWait: 10_000, timeout: 120_000 });
}
