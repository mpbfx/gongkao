import { describe, expect, it } from "vitest";

import {
  buildSubtitleChunks,
  normalizeSubtitleText,
  parseAndCleanSrt,
  vectorPointIdFromHash,
} from "@/server/knowledge/subtitle-pipeline";

function srt(items: Array<{ start: string; end: string; text: string }>) {
  return items.map((item, index) => `${index + 1}\n${item.start} --> ${item.end}\n${item.text}\n`).join("\n");
}

describe("subtitle pipeline", () => {
  it("normalizes unicode, tags, whitespace and zero-width characters", () => {
    expect(normalizeSubtitleText("Ａ\u200B  <b>增长率</b>\n  方法")).toBe("A 增长率 方法");
  });

  it("drops music cues and merges exact and rolling duplicates", () => {
    const cues = parseAndCleanSrt(srt([
      { start: "00:00:00,000", end: "00:00:01,000", text: "[音乐]" },
      { start: "00:00:01,000", end: "00:00:02,000", text: "先找基期量" },
      { start: "00:00:02,000", end: "00:00:03,000", text: "先找基期量" },
      { start: "00:00:03,000", end: "00:00:04,000", text: "先找基期量再列式" },
    ]));

    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ cleanText: "先找基期量再列式", startMs: 1_000, endMs: 4_000 });
  });

  it("keeps raw text and splits at a long pause", () => {
    const cues = parseAndCleanSrt(srt([
      { start: "00:00:00,000", end: "00:00:01,000", text: "<i>第一段</i>" },
      { start: "00:00:25,000", end: "00:00:26,000", text: "第二段" },
    ]));
    const chunks = buildSubtitleChunks(cues, { bvid: "BV1", partNo: 1, targetCharacters: 100 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.rawText).toContain("<i>第一段</i>");
    expect(chunks[1]?.startMs).toBe(25_000);
  });

  it("creates bounded chunks with overlap and stable UUID point ids", () => {
    const cues = Array.from({ length: 12 }, (_, index) => ({
      rawText: `第${index}条知识点内容`,
      cleanText: `第${index}条知识点内容`,
      startMs: index * 1_000,
      endMs: index * 1_000 + 900,
    }));
    const chunks = buildSubtitleChunks(cues, {
      bvid: "BV1",
      partNo: 2,
      targetCharacters: 35,
      maxCharacters: 55,
      overlapCharacters: 12,
    });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.cleanText.length <= 60)).toBe(true);
    expect(chunks[1]?.cleanText).toContain(chunks[0]!.cleanText.split(" ").at(-1));
    expect(chunks[0]?.vectorPointId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(vectorPointIdFromHash("a".repeat(64))).toBe(vectorPointIdFromHash("a".repeat(64)));
  });
});
