import { z } from "zod";

import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { BusinessError, NotFoundError } from "@/server/services/errors";
import { createQuestionPracticeSession } from "@/server/services/practice";
import { createFoundationPracticeSession } from "@/server/services/foundation-training";
import { getPracticeQuestionWhere } from "@/server/services/practice-question-policy";
import { listActiveTagsFlat } from "@/server/services/tags";

export const createSpecialSessionSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== "object" || !("reqs" in value)) return value;
    const legacy = value as { reqs?: Array<{ tagId?: string; num?: number }> };
    return {
      protocol: "CUSTOM",
      tagId: legacy.reqs?.[0]?.tagId,
      count: legacy.reqs?.[0]?.num,
    };
  },
  z.discriminatedUnion("protocol", [
    z.object({ protocol: z.literal("FOUNDATION"), tagId: z.string().min(1) }),
    z.object({
      protocol: z.literal("CUSTOM"),
      tagId: z.string().min(1),
      count: z.coerce.number().int().min(1).max(100),
      difficulty: z.enum(["EASY", "MEDIUM", "HARD", "UNKNOWN"]).nullish(),
    }),
  ])
);

export type CreateSpecialSessionInput = z.infer<typeof createSpecialSessionSchema>;

function shuffle<T>(items: T[]) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }

  return result;
}

function descendantIdsByTag(
  tags: Awaited<ReturnType<typeof listActiveTagsFlat>>
) {
  const childrenByParent = new Map<string, string[]>();

  for (const tag of tags) {
    if (tag.parentId) {
      const current = childrenByParent.get(tag.parentId) ?? [];
      current.push(tag.id);
      childrenByParent.set(tag.parentId, current);
    }
  }

  function collect(tagId: string, ids = new Set<string>()) {
    ids.add(tagId);

    for (const childId of childrenByParent.get(tagId) ?? []) {
      collect(childId, ids);
    }

    return ids;
  }

  return new Map(tags.map((tag) => [tag.id, collect(tag.id)]));
}

export async function createSpecialPracticeSession(
  user: AuthenticatedUser,
  input: CreateSpecialSessionInput
) {
  if (input.protocol === "FOUNDATION") {
    return createFoundationPracticeSession(user, input.tagId);
  }

  const reqs = [{ tagId: input.tagId, num: input.count }];
  const tags = await listActiveTagsFlat();
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const missingTag = reqs.find((req) => !tagById.has(req.tagId));

  if (missingTag) {
    throw new NotFoundError("专项分类不存在");
  }

  const selectedTag = tagById.get(input.tagId);

  const descendantsByTag = descendantIdsByTag(tags);
  const selectedQuestionIds = new Set<string>();
  const questionWhere = await getPracticeQuestionWhere(user, input.difficulty);

  for (const req of reqs) {
    const tagIds = Array.from(descendantsByTag.get(req.tagId) ?? new Set([req.tagId]));
    const candidates = await prisma.question.findMany({
      where: {
        ...questionWhere,
        tagId: { in: tagIds },
      },
      include: {
        material: { select: { id: true, title: true, contentHtml: true } },
        tag: { select: { id: true, name: true } },
        options: { orderBy: { sortOrder: "asc" } },
      },
    });
    const freshCandidates = shuffle(candidates).filter((question) => !selectedQuestionIds.has(question.id));

    for (const question of freshCandidates.slice(0, req.num)) {
      selectedQuestionIds.add(question.id);
    }
  }

  if (selectedQuestionIds.size === 0) {
    throw new BusinessError("当前条件下没有可练习的题目");
  }

  const questions = shuffle(
    await prisma.question.findMany({
      where: {
        id: { in: Array.from(selectedQuestionIds) },
        ...questionWhere,
      },
      include: {
        material: { select: { id: true, title: true, contentHtml: true } },
        tag: { select: { id: true, name: true } },
        options: { orderBy: { sortOrder: "asc" } },
      },
    })
  );
  const tagName = selectedTag?.name ?? "专项";

  return createQuestionPracticeSession({
    user,
    mode: "SPECIAL",
    title: `专项练习：${tagName}`,
    questions,
    sourceTagIdsJson: [{ tagId: input.tagId, num: questions.length }],
    difficulty: input.difficulty ?? null,
  });
}
