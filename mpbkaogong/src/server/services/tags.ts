import { prisma } from "@/lib/db/prisma";

type TagRow = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  isMaterialOnly: boolean;
};

const hiddenStudentTagSlugs = new Set(["common-sense", "verbal", "judgement"]);

const rootSortOrderByName = new Map([
  ["常识判断", 10],
  ["言语理解", 20],
  ["数量关系", 30],
  ["判断推理", 40],
  ["资料分析", 50],
]);

const fallbackParentNameByTagName = new Map([
  ["政治理论", "常识判断"],
  ["公文", "常识判断"],
  ["历史", "常识判断"],
  ["管理", "常识判断"],
  ["新思想", "常识判断"],
  ["病语", "言语理解"],
  ["歧义句", "言语理解"],
  ["逻辑题空", "言语理解"],
  ["不定方程", "数量关系"],
  ["方阵问题", "数量关系"],
  ["星期日期", "数量关系"],
  ["牛吃草", "数量关系"],
  ["集合推理", "判断推理"],
  ["图像推理", "判断推理"],
  ["论证缺陷", "判断推理"],
  ["综合分析", "资料分析"],
]);

export type TagTreeNode = {
  id: string;
  name: string;
  slug: string;
  isMaterialOnly: boolean;
  questionCount: number;
  children: TagTreeNode[];
};

function normalizeStudentTags(tags: TagRow[]) {
  const visibleTags = tags.filter((tag) => !hiddenStudentTagSlugs.has(tag.slug));
  const rootIdByName = new Map(
    visibleTags.filter((tag) => !tag.parentId).map((tag) => [tag.name, tag.id])
  );

  return visibleTags
    .map((tag) => {
      const fallbackParentName = !tag.parentId ? fallbackParentNameByTagName.get(tag.name) : undefined;
      const fallbackParentId = fallbackParentName ? rootIdByName.get(fallbackParentName) : undefined;

      return {
        ...tag,
        parentId: fallbackParentId && fallbackParentId !== tag.id ? fallbackParentId : tag.parentId,
        sortOrder: rootSortOrderByName.get(tag.name) ?? tag.sortOrder,
      };
    })
    .toSorted((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name, "zh-CN"));
}

export async function listActiveTagsTree() {
  const [tags, questions] = await Promise.all([
    prisma.questionTag.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        sortOrder: true,
        isMaterialOnly: true,
      },
    }),
    prisma.question.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        tagId: { not: null },
      },
      select: { tagId: true },
    }),
  ]);

  const normalizedTags = normalizeStudentTags(tags);
  const directCounts = new Map<string, number>();
  for (const question of questions) {
    if (question.tagId) {
      directCounts.set(question.tagId, (directCounts.get(question.tagId) ?? 0) + 1);
    }
  }

  const nodeById = new Map<string, TagTreeNode>();
  for (const tag of normalizedTags) {
    nodeById.set(tag.id, {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      isMaterialOnly: tag.isMaterialOnly,
      questionCount: directCounts.get(tag.id) ?? 0,
      children: [],
    });
  }

  const roots: TagTreeNode[] = [];
  for (const tag of normalizedTags) {
    const node = nodeById.get(tag.id);

    if (!node) {
      continue;
    }

    if (tag.parentId && nodeById.has(tag.parentId)) {
      nodeById.get(tag.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function rollupCount(node: TagTreeNode) {
    for (const child of node.children) {
      node.questionCount += rollupCount(child);
    }

    return node.questionCount;
  }

  for (const root of roots) {
    rollupCount(root);
  }

  return roots;
}

export async function listActiveTagsFlat() {
  const tags = await prisma.questionTag.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      sortOrder: true,
      isMaterialOnly: true,
    },
  });

  return normalizeStudentTags(tags) satisfies TagRow[];
}
