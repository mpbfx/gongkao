import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/db/prisma";
import { embedTexts } from "@/server/knowledge/embeddings";
import { loadKnowledgeConfig } from "@/server/knowledge/config";
import { deleteKnowledgeVectors, ensureKnowledgeCollection, upsertKnowledgeVectors } from "@/server/knowledge/qdrant";
import { buildSubtitleChunks, parseAndCleanSrt, sourceContentHash } from "@/server/knowledge/subtitle-pipeline";

type ImportSummary = {
  jobId: string;
  sourceIds: string[];
  totalChunks: number;
  indexedChunks: number;
  failedChunks: number;
};

function serializeError(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function importMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { sourceIds: [] as string[] };
  const sourceIds = (value as { sourceIds?: unknown }).sourceIds;
  return { sourceIds: Array.isArray(sourceIds) ? sourceIds.filter((item): item is string => typeof item === "string") : [] };
}

export async function indexKnowledgeSources(sourceIds: string[]) {
  if (sourceIds.length === 0) return { indexed: 0, failed: 0 };
  const config = loadKnowledgeConfig();
  await ensureKnowledgeCollection();
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { sourceId: { in: sourceIds }, indexStatus: { in: ["PENDING", "FAILED"] } },
    orderBy: [{ sourceId: "asc" }, { chunkNo: "asc" }],
    include: { source: true },
  });
  let indexed = 0;
  let failed = 0;

  for (let offset = 0; offset < chunks.length; offset += config.embeddingBatchSize) {
    const batch = chunks.slice(offset, offset + config.embeddingBatchSize);
    try {
      const vectors = await embedTexts(batch.map((chunk) => chunk.cleanText));
      await upsertKnowledgeVectors(
        batch.map((chunk, index) => ({
          id: chunk.vectorPointId,
          vector: vectors[index]!,
          payload: {
            chunkId: chunk.id,
            sourceId: chunk.sourceId,
            bvid: chunk.source.bvid,
            partNo: chunk.source.partNo,
            title: chunk.source.title,
            startMs: chunk.startMs,
            endMs: chunk.endMs,
            contentHash: chunk.contentHash,
          },
        }))
      );
      await prisma.knowledgeChunk.updateMany({
        where: { id: { in: batch.map((chunk) => chunk.id) } },
        data: { indexStatus: "INDEXED", indexError: null },
      });
      indexed += batch.length;
    } catch (error) {
      const message = serializeError(error);
      await prisma.knowledgeChunk.updateMany({
        where: { id: { in: batch.map((chunk) => chunk.id) } },
        data: { indexStatus: "FAILED", indexError: message },
      });
      failed += batch.length;
      throw error;
    }
  }

  return { indexed, failed };
}

async function importSubtitleFile({
  filename,
  bvid,
  partNo,
  title,
}: {
  filename: string;
  bvid: string;
  partNo: number;
  title: string;
}) {
  const raw = await readFile(filename, "utf8");
  const fileHash = sourceContentHash(raw);
  const existing = await prisma.knowledgeSource.findUnique({ where: { bvid_partNo: { bvid, partNo } } });
  const source = await prisma.knowledgeSource.upsert({
    where: { bvid_partNo: { bvid, partNo } },
    create: {
      bvid,
      partNo,
      title,
      sourceFile: path.basename(filename),
      contentHash: fileHash,
      status: "IMPORTING",
    },
    update: {
      title,
      sourceFile: path.basename(filename),
      status: "IMPORTING",
      lastError: null,
    },
  });

  if (existing?.contentHash === fileHash) {
    const result = await indexKnowledgeSources([source.id]);
    const failed = await prisma.knowledgeChunk.count({ where: { sourceId: source.id, indexStatus: "FAILED" } });
    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: { status: failed > 0 ? "FAILED" : "READY", lastError: failed > 0 ? "存在索引失败的知识片段。" : null },
    });
    return { sourceId: source.id, chunks: await prisma.knowledgeChunk.count({ where: { sourceId: source.id } }), ...result };
  }

  const oldChunks = await prisma.knowledgeChunk.findMany({
    where: { sourceId: source.id },
    select: { vectorPointId: true },
  });
  await deleteKnowledgeVectors(oldChunks.map((chunk) => chunk.vectorPointId));

  const cues = parseAndCleanSrt(raw);
  const chunks = buildSubtitleChunks(cues, { bvid, partNo });
  await prisma.$transaction(async (tx) => {
    await tx.knowledgeChunk.deleteMany({ where: { sourceId: source.id } });
    if (chunks.length > 0) {
      await tx.knowledgeChunk.createMany({
        data: chunks.map((chunk) => ({
          sourceId: source.id,
          chunkNo: chunk.chunkNo,
          startMs: chunk.startMs,
          endMs: chunk.endMs,
          rawText: chunk.rawText,
          cleanText: chunk.cleanText,
          contentHash: chunk.contentHash,
          vectorPointId: chunk.vectorPointId,
        })),
      });
    }
    await tx.knowledgeSource.update({
      where: { id: source.id },
      data: {
        contentHash: fileHash,
        durationMs: cues.at(-1)?.endMs ?? null,
        status: "INDEXING",
      },
    });
  });

  try {
    const result = await indexKnowledgeSources([source.id]);
    await prisma.knowledgeSource.update({ where: { id: source.id }, data: { status: "READY", lastError: null } });
    return { sourceId: source.id, chunks: chunks.length, ...result };
  } catch (error) {
    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: { status: "FAILED", lastError: serializeError(error) },
    });
    throw error;
  }
}

export async function importSubtitleDirectory({
  directory,
  bvid,
  titlePrefix,
}: {
  directory: string;
  bvid: string;
  titlePrefix?: string;
}): Promise<ImportSummary> {
  const filenames = (await readdir(directory))
    .map((name) => ({ name, match: /^P(\d+)_transcript\.srt$/i.exec(name) }))
    .filter((item): item is { name: string; match: RegExpExecArray } => Boolean(item.match))
    .sort((left, right) => Number(left.match[1]) - Number(right.match[1]));

  if (filenames.length === 0) throw new Error("目录中没有找到 P{数字}_transcript.srt 字幕文件。");

  const job = await prisma.importJob.create({
    data: {
      userId: null,
      type: "COURSE_SUBTITLE",
      filename: directory,
      status: "RUNNING",
      totalRows: filenames.length,
      errorJson: { sourceIds: [] },
    },
  });
  const sourceIds: string[] = [];
  let totalChunks = 0;
  let indexedChunks = 0;
  let failedChunks = 0;
  let completedFiles = 0;
  const errors: Array<{ file: string; message: string }> = [];

  for (const item of filenames) {
    const partNo = Number(item.match[1]);
    try {
      const result = await importSubtitleFile({
        filename: path.join(directory, item.name),
        bvid,
        partNo,
        title: `${titlePrefix?.trim() || bvid} 第${partNo}P`,
      });
      sourceIds.push(result.sourceId);
      completedFiles += 1;
      totalChunks += result.chunks;
      indexedChunks += result.indexed;
      failedChunks += result.failed;
    } catch (error) {
      errors.push({ file: item.name, message: serializeError(error) });
      const failedSource = await prisma.knowledgeSource.findUnique({ where: { bvid_partNo: { bvid, partNo } } });
      if (failedSource && !sourceIds.includes(failedSource.id)) sourceIds.push(failedSource.id);
      failedChunks += 1;
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        successRows: completedFiles,
        failedRows: errors.length,
        errorJson: { sourceIds, errors },
      },
    });
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: { status: errors.length > 0 ? "FAILED" : "COMPLETED", errorJson: { sourceIds, errors } },
  });

  return { jobId: job.id, sourceIds, totalChunks, indexedChunks, failedChunks };
}

export async function resumeKnowledgeImport(jobId: string) {
  const job = await prisma.importJob.findFirst({ where: { id: jobId, type: "COURSE_SUBTITLE" } });
  if (!job) throw new Error("知识库导入任务不存在。");
  const { sourceIds } = importMetadata(job.errorJson);
  const result = await indexKnowledgeSources(sourceIds);
  const failed = await prisma.knowledgeChunk.count({ where: { sourceId: { in: sourceIds }, indexStatus: "FAILED" } });
  for (const sourceId of sourceIds) {
    const sourceFailed = await prisma.knowledgeChunk.count({ where: { sourceId, indexStatus: "FAILED" } });
    await prisma.knowledgeSource.updateMany({
      where: { id: sourceId },
      data: {
        status: sourceFailed > 0 ? "FAILED" : "READY",
        lastError: sourceFailed > 0 ? "存在索引失败的知识片段。" : null,
      },
    });
  }
  await prisma.importJob.update({
    where: { id: job.id },
    data: { status: failed > 0 ? "FAILED" : "COMPLETED", failedRows: failed },
  });
  return { jobId, sourceIds, ...result, remainingFailed: failed };
}

export async function reindexKnowledgeSource(sourceId: string) {
  const source = await prisma.knowledgeSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error("知识来源不存在。");
  const chunks = await prisma.knowledgeChunk.findMany({ where: { sourceId }, select: { vectorPointId: true } });
  await deleteKnowledgeVectors(chunks.map((chunk) => chunk.vectorPointId));
  await prisma.knowledgeChunk.updateMany({
    where: { sourceId },
    data: { indexStatus: "PENDING", indexError: null },
  });
  await prisma.knowledgeSource.update({ where: { id: sourceId }, data: { status: "INDEXING", lastError: null } });
  try {
    const result = await indexKnowledgeSources([sourceId]);
    await prisma.knowledgeSource.update({ where: { id: sourceId }, data: { status: "READY" } });
    return { sourceId, ...result };
  } catch (error) {
    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { status: "FAILED", lastError: serializeError(error) },
    });
    throw error;
  }
}
