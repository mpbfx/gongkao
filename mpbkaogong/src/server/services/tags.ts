import { prisma } from "@/lib/db/prisma";

type TagRow = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  isMaterialOnly: boolean;
};

export type TagTreeNode = {
  id: string;
  name: string;
  slug: string;
  isMaterialOnly: boolean;
  questionCount: number;
  children: TagTreeNode[];
};

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

  const directCounts = new Map<string, number>();
  for (const question of questions) {
    if (question.tagId) {
      directCounts.set(question.tagId, (directCounts.get(question.tagId) ?? 0) + 1);
    }
  }

  const nodeById = new Map<string, TagTreeNode>();
  for (const tag of tags) {
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
  for (const tag of tags) {
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
  return prisma.questionTag.findMany({
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
  }) satisfies Promise<TagRow[]>;
}
