import { describe, expect, it } from "vitest";

import {
  filterTags,
  normalizeTagSearch,
  type TagNode,
} from "./special-practice-utils";

const tags: TagNode[] = [
  {
    id: "reasoning",
    name: "判断推理",
    slug: "reasoning",
    isMaterialOnly: false,
    questionCount: 20,
    children: [
      {
        id: "graphic",
        name: "图形推理",
        slug: "graphic-reasoning",
        isMaterialOnly: false,
        questionCount: 10,
        children: [],
      },
    ],
  },
];

describe("special practice utilities", () => {
  it("normalizes and filters nested tags", () => {
    const result = filterTags(tags, normalizeTagSearch("  图形 "));

    expect(result).toHaveLength(1);
    expect(result[0]?.children[0]?.id).toBe("graphic");
  });
});
