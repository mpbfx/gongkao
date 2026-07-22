import { describe, expect, it } from "vitest";

import {
  buildQuestionTagHierarchyUpdates,
  normalizeQuestionTagRows,
} from "@/server/domain/question-tag-taxonomy";

describe("question tag taxonomy", () => {
  it("reattaches known orphan tags to their canonical root", () => {
    const tags = normalizeQuestionTagRows([
      { id: "root", name: "判断推理", parentId: null, sortOrder: 0 },
      { id: "orphan", name: "图像推理", parentId: null, sortOrder: 1000 },
    ]);

    expect(tags.find((tag) => tag.id === "orphan")?.parentId).toBe("root");
  });

  it("preserves an explicit parent instead of applying a fallback", () => {
    const tags = normalizeQuestionTagRows([
      { id: "root", name: "判断推理", parentId: null, sortOrder: 0 },
      { id: "custom", name: "图像推理", parentId: "custom-root", sortOrder: 1 },
    ]);

    expect(tags.find((tag) => tag.id === "custom")?.parentId).toBe("custom-root");
  });

  it("uses the stable product order for canonical roots", () => {
    const tags = normalizeQuestionTagRows([
      { id: "judgement", name: "判断推理", parentId: null, sortOrder: 1 },
      { id: "verbal", name: "言语理解", parentId: null, sortOrder: 99 },
    ]);

    expect(tags.map((tag) => tag.name)).toEqual(["言语理解", "判断推理"]);
  });

  it("rebuilds depth, path, and leaf metadata from stored parents", () => {
    expect(
      buildQuestionTagHierarchyUpdates([
        { id: "root", name: "判断推理", parentId: null },
        { id: "child", name: "图形推理", parentId: "root" },
      ])
    ).toEqual([
      { id: "root", depth: 0, path: "判断推理", isLeaf: false },
      { id: "child", depth: 1, path: "判断推理/图形推理", isLeaf: true },
    ]);
  });

  it("rejects cyclic hierarchies", () => {
    expect(() =>
      buildQuestionTagHierarchyUpdates([
        { id: "first", name: "第一层", parentId: "second" },
        { id: "second", name: "第二层", parentId: "first" },
      ])
    ).toThrow("Question tag hierarchy contains a cycle");
  });
});
