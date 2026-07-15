import { prisma } from "@/lib/db/prisma";
import { embedQuery } from "@/server/knowledge/embeddings";
import { searchKnowledgeVectors } from "@/server/knowledge/qdrant";
import type { KnowledgeSearchInput, KnowledgeSearchResult } from "@/server/knowledge/types";

export function bilibiliKnowledgeUrl(bvid: string, partNo: number, startMs: number) {
  return `https://www.bilibili.com/video/${encodeURIComponent(bvid)}?p=${partNo}&t=${Math.floor(startMs / 1_000)}`;
}

function buildSearchQuery(input: KnowledgeSearchInput) {
  return [
    input.query.trim(),
    input.questionTagName?.trim() ? `知识点：${input.questionTagName.trim()}` : "",
    input.questionText?.trim() ? `相关题目：${input.questionText.trim().slice(0, 800)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function payloadString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export async function searchCourseKnowledge(input: KnowledgeSearchInput): Promise<KnowledgeSearchResult[]> {
  const query = buildSearchQuery(input);
  if (!query) return [];
  const requestedLimit = Math.min(Math.max(input.limit ?? 5, 1), 5);
  const vector = await embedQuery(query);
  const hits = await searchKnowledgeVectors(vector);
  const scoredIds = hits
    .map((hit) => ({ chunkId: payloadString(hit.payload?.chunkId), score: hit.score }))
    .filter((item): item is { chunkId: string; score: number } => Boolean(item.chunkId));
  if (scoredIds.length === 0) return [];

  const rows = await prisma.knowledgeChunk.findMany({
    where: { id: { in: scoredIds.map((item) => item.chunkId) }, indexStatus: "INDEXED" },
    include: { source: true },
  });
  const rowMap = new Map(rows.map((row) => [row.id, row]));
  const ordered = scoredIds.flatMap((item) => {
    const row = rowMap.get(item.chunkId);
    return row ? [{ row, score: item.score }] : [];
  });
  const merged: KnowledgeSearchResult[] = [];

  for (const item of ordered) {
    const result: KnowledgeSearchResult = {
      chunkId: item.row.id,
      sourceId: item.row.sourceId,
      title: item.row.source.title,
      quote: item.row.cleanText,
      score: item.score,
      bvid: item.row.source.bvid,
      partNo: item.row.source.partNo,
      startMs: item.row.startMs,
      endMs: item.row.endMs,
      url: bilibiliKnowledgeUrl(item.row.source.bvid, item.row.source.partNo, item.row.startMs),
    };
    const adjacentIndex = merged.findIndex(
      (current) => current.sourceId === result.sourceId && Math.abs(current.endMs - result.startMs) <= 20_000
    );

    if (adjacentIndex >= 0) {
      const current = merged[adjacentIndex]!;
      current.quote = `${current.quote}\n${result.quote}`.slice(0, 1_600);
      current.startMs = Math.min(current.startMs, result.startMs);
      current.endMs = Math.max(current.endMs, result.endMs);
      current.score = Math.max(current.score, result.score);
      current.url = bilibiliKnowledgeUrl(current.bvid, current.partNo, current.startMs);
      continue;
    }

    merged.push(result);
    if (merged.length >= requestedLimit) break;
  }

  return merged;
}
