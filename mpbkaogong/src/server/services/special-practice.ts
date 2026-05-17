import { z } from "zod";

import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { BusinessError, NotFoundError } from "@/server/services/errors";
import { createQuestionPracticeSession } from "@/server/services/practice";
import { listActiveTagsFlat } from "@/server/services/tags";

export const createSpecialSessionSchema = z.object({
  mode: z.literal("SPECIAL").optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD", "UNKNOWN"]).nullish(),
  reqs: z
    .array(
      z.object({
        tagId: z.string().min(1),
        num: z.coerce.number().int().min(1).max(100),
      })
    )
    .min(1),
});

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
  const requestedTotal = input.reqs.reduce((total, req) => total + req.num, 0);

  if (requestedTotal < 5) {
    throw new BusinessError("专项练习总题数不能少于 5 题");
  }

  const tags = await listActiveTagsFlat();
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const missingTag = input.reqs.find((req) => !tagById.has(req.tagId));

  if (missingTag) {
    throw new NotFoundError("专项分类不存在");
  }

  const selectedTags = input.reqs.map((req) => tagById.get(req.tagId)).filter(Boolean);
  const hasMaterialOnly = selectedTags.some((tag) => tag?.isMaterialOnly);

  if (hasMaterialOnly && selectedTags.length > 1) {
    throw new BusinessError("材料类专项不能和其他专项混练");
  }

  const descendantsByTag = descendantIdsByTag(tags);
  const selectedQuestionIds = new Set<string>();

  for (const req of input.reqs) {
    const tagIds = Array.from(descendantsByTag.get(req.tagId) ?? new Set([req.tagId]));
    const candidates = await prisma.question.findMany({
      where: {
        isActive: true,
        deletedAt: null,
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

  if (selectedQuestionIds.size < requestedTotal) {
    throw new BusinessError("当前条件下题量不足，请减少题数或调整知识点");
  }

  if (selectedQuestionIds.size < 5) {
    throw new BusinessError("可练习题目不足 5 题");
  }

  const questions = shuffle(
    await prisma.question.findMany({
      where: {
        id: { in: Array.from(selectedQuestionIds) },
      },
      include: {
        material: { select: { id: true, title: true, contentHtml: true } },
        tag: { select: { id: true, name: true } },
        options: { orderBy: { sortOrder: "asc" } },
      },
    })
  );
  const tagNames = selectedTags.map((tag) => tag?.name).filter(Boolean).join("、");

  return createQuestionPracticeSession({
    user,
    mode: "SPECIAL",
    title: `专项练习：${tagNames}`,
    questions,
    sourceTagIdsJson: input.reqs,
    difficulty: null,
  });
}
