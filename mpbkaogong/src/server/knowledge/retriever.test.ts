import { describe, expect, it } from "vitest";

import { bilibiliKnowledgeUrl } from "@/server/knowledge/retriever";

describe("bilibiliKnowledgeUrl", () => {
  it("creates a part and timestamp deep link", () => {
    expect(bilibiliKnowledgeUrl("BV1pkKU68EXt", 13, 625_900)).toBe(
      "https://www.bilibili.com/video/BV1pkKU68EXt?p=13&t=625"
    );
  });
});
