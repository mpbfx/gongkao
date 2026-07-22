export type QuestionTagTaxonomyRow = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

export const rootSortOrderByName = new Map([
  ["常识判断", 10],
  ["言语理解", 20],
  ["数量关系", 30],
  ["判断推理", 40],
  ["资料分析", 50],
]);

export const fallbackParentNameByTagName = new Map([
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

export const seedTagAssignments = [
  { slug: "common-sense", parentName: "常识判断" },
  { slug: "verbal", parentName: "言语理解" },
  { slug: "judgement", parentName: "判断推理" },
] as const;

export const tagAliasMerges = [
  { sourceName: "逻辑题空", targetName: "逻辑填空" },
  { sourceName: "图像推理", targetName: "图形推理" },
] as const;

export const directQuestionLeafByRootName = new Map([
  [
    "资料分析",
    {
      id: "system_tag_data_analysis_unclassified",
      name: "未细分题目",
      slug: "data-analysis-unclassified",
      sortOrder: 9990,
    },
  ],
]);

export function normalizeQuestionTagRows<T extends QuestionTagTaxonomyRow>(tags: T[]) {
  const rootIdByName = new Map(
    tags.filter((tag) => !tag.parentId).map((tag) => [tag.name, tag.id])
  );

  return tags
    .map((tag) => {
      const fallbackParentName = !tag.parentId
        ? fallbackParentNameByTagName.get(tag.name)
        : undefined;
      const fallbackParentId = fallbackParentName
        ? rootIdByName.get(fallbackParentName)
        : undefined;

      return {
        ...tag,
        parentId:
          fallbackParentId && fallbackParentId !== tag.id
            ? fallbackParentId
            : tag.parentId,
        sortOrder: rootSortOrderByName.get(tag.name) ?? tag.sortOrder,
      };
    })
    .toSorted(
      (first, second) =>
        first.sortOrder - second.sortOrder ||
        first.name.localeCompare(second.name, "zh-CN")
    );
}

export function buildQuestionTagHierarchyUpdates(
  tags: Array<{ id: string; name: string; parentId: string | null }>
) {
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const childIdsByParentId = new Map<string, string[]>();
  for (const tag of tags) {
    if (!tag.parentId || !tagById.has(tag.parentId)) continue;
    const childIds = childIdsByParentId.get(tag.parentId) ?? [];
    childIds.push(tag.id);
    childIdsByParentId.set(tag.parentId, childIds);
  }

  const updates: Array<{ id: string; depth: number; path: string; isLeaf: boolean }> = [];
  const visited = new Set<string>();

  function visit(tag: { id: string; name: string }, depth: number, parentPath: string) {
    if (visited.has(tag.id)) return;
    visited.add(tag.id);
    const path = parentPath ? `${parentPath}/${tag.name}` : tag.name;
    const childIds = childIdsByParentId.get(tag.id) ?? [];
    updates.push({ id: tag.id, depth, path, isLeaf: childIds.length === 0 });
    for (const childId of childIds) {
      const child = tagById.get(childId);
      if (child) visit(child, depth + 1, path);
    }
  }

  for (const tag of tags) {
    if (!tag.parentId || !tagById.has(tag.parentId)) visit(tag, 0, "");
  }

  if (updates.length !== tags.length) {
    throw new Error("Question tag hierarchy contains a cycle");
  }

  return updates;
}
