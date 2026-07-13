export type TagNode = {
  id: string;
  name: string;
  slug: string;
  isMaterialOnly: boolean;
  questionCount: number;
  children: TagNode[];
};

export type VisibleTagNode = Omit<TagNode, "children"> & {
  children: VisibleTagNode[];
};

export function normalizeTagSearch(value: string) {
  return value.trim().toLowerCase();
}

export function filterTags(tags: TagNode[], query: string): VisibleTagNode[] {
  if (!query) {
    return tags;
  }

  return tags.flatMap((tag) => {
    const filteredChildren = filterTags(tag.children, query);
    const matches = tag.name.toLowerCase().includes(query) || tag.slug.toLowerCase().includes(query);

    return matches || filteredChildren.length > 0
      ? [{ ...tag, children: filteredChildren }]
      : [];
  });
}
