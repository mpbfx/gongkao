import { prisma } from "@/lib/db/prisma";

export type TagRow = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  isMaterialOnly: boolean;
  depth: number;
  path: string | null;
  isLeaf: boolean;
};

export type TagTreeNode = {
  id: string;
  name: string;
  slug: string;
  isMaterialOnly: boolean;
  depth: number;
  path: string | null;
  isLeaf: boolean;
  questionCount: number;
  children: TagTreeNode[];
};

function sortTags<T extends Pick<TagRow, "sortOrder" | "name">>(tags: T[]) {
  return tags.toSorted(
    (first, second) =>
      first.sortOrder - second.sortOrder || first.name.localeCompare(second.name, "zh-CN")
  );
}

const tagSelect = {
  id: true,
  name: true,
  slug: true,
  parentId: true,
  sortOrder: true,
  isMaterialOnly: true,
  depth: true,
  path: true,
  isLeaf: true,
} as const;

export async function listActiveTagsTree() {
  const [tags, questionGroups] = await Promise.all([
    prisma.questionTag.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: tagSelect,
    }),
    prisma.question.groupBy({
      by: ["tagId"],
      where: { isActive: true, deletedAt: null, tagId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const directCounts = new Map(
    questionGroups.flatMap((group) =>
      group.tagId ? [[group.tagId, group._count._all] as const] : []
    )
  );
  const normalizedTags = sortTags(tags);
  const nodeById = new Map<string, TagTreeNode>();

  for (const tag of normalizedTags) {
    nodeById.set(tag.id, {
      ...tag,
      questionCount: directCounts.get(tag.id) ?? 0,
      children: [],
    });
  }

  const roots: TagTreeNode[] = [];
  for (const tag of normalizedTags) {
    const node = nodeById.get(tag.id);
    if (!node) continue;

    if (tag.parentId && nodeById.has(tag.parentId)) {
      nodeById.get(tag.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function rollupCount(node: TagTreeNode) {
    for (const child of node.children) node.questionCount += rollupCount(child);
    return node.questionCount;
  }

  for (const root of roots) rollupCount(root);
  return roots;
}

export async function listActiveTagsFlat() {
  const tags = await prisma.questionTag.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: tagSelect,
  });

  return sortTags(tags) satisfies TagRow[];
}
