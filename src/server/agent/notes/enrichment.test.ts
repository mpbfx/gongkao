import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  noteFindFirst: vi.fn(),
  noteFindMany: vi.fn(),
  noteUpdateMany: vi.fn(),
  tagFindMany: vi.fn(),
  txNoteUpdateMany: vi.fn(),
  txTagDeleteMany: vi.fn(),
  txTagFindMany: vi.fn(),
  txTagCreateMany: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    agentNote: {
      findFirst: mocks.noteFindFirst,
      findMany: mocks.noteFindMany,
      updateMany: mocks.noteUpdateMany,
    },
    questionTag: { findMany: mocks.tagFindMany },
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        agentNote: { updateMany: mocks.txNoteUpdateMany },
        agentNoteTag: {
          deleteMany: mocks.txTagDeleteMany,
          findMany: mocks.txTagFindMany,
          createMany: mocks.txTagCreateMany,
        },
      }),
  },
}));

vi.mock("@/server/agent/shared/llm", () => ({
  generateStructuredResponseWithStatus: mocks.generate,
}));

import {
  enrichAgentNote,
  findAgentNotesNeedingReconciliation,
  markAgentNoteFailed,
} from "@/server/agent/notes/enrichment";

const job = { noteId: "note-1", userId: "user-1", generationVersion: 2 };
const pendingNote = {
  id: "note-1",
  userId: "user-1",
  generationVersion: 2,
  status: "PENDING",
  originalPrompt: "如何判断增长率？",
  originalContent: "先比较现期量与基期量。",
  sourceContextJson: null,
  citationsSnapshotJson: null,
};

describe("agent note enrichment", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.noteUpdateMany.mockResolvedValue({ count: 1 });
    mocks.txTagDeleteMany.mockResolvedValue({ count: 1 });
    mocks.txTagFindMany.mockResolvedValue([]);
    mocks.txTagCreateMany.mockResolvedValue({ count: 1 });
  });

  it("skips stale, deleted, trashed, or already-ready deliveries", async () => {
    mocks.noteFindFirst.mockResolvedValue(null);

    await expect(enrichAgentNote(job)).resolves.toEqual({ skipped: true });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.noteUpdateMany).not.toHaveBeenCalled();
  });

  it("atomically replaces AI tags while preserving matching human tags", async () => {
    mocks.noteFindFirst.mockResolvedValue(pendingNote);
    mocks.tagFindMany.mockResolvedValue([
      { id: "leaf-ai", name: "增长率", path: "资料分析/增长率" },
      { id: "leaf-human", name: "基期量", path: "资料分析/基期量" },
    ]);
    mocks.generate.mockResolvedValue({
      usedFallback: false,
      data: {
        title: "增长率判断",
        markdown: "归纳正文",
        keyPoints: ["比较现期量与基期量"],
        pitfalls: ["不要混淆增量"],
        applications: ["资料分析"],
        tagIds: ["leaf-ai", "leaf-human", "inactive-tag"],
      },
    });
    mocks.txNoteUpdateMany.mockResolvedValue({ count: 1 });
    mocks.txTagFindMany.mockResolvedValue([{ tagId: "leaf-human" }]);

    await expect(enrichAgentNote(job)).resolves.toEqual({ skipped: false });
    expect(mocks.txTagDeleteMany).toHaveBeenCalledWith({
      where: { noteId: "note-1", attachedBy: "AI" },
    });
    expect(mocks.txTagCreateMany).toHaveBeenCalledWith({
      data: [{ noteId: "note-1", tagId: "leaf-ai", attachedBy: "AI" }],
      skipDuplicates: true,
    });
    expect(mocks.txNoteUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ generationVersion: 2, status: "PROCESSING" }),
        data: expect.objectContaining({ status: "READY", aiTitle: "增长率判断" }),
      })
    );
  });

  it("throws invalid model output so BullMQ can retry it", async () => {
    mocks.noteFindFirst.mockResolvedValue(pendingNote);
    mocks.tagFindMany.mockResolvedValue([]);
    mocks.generate.mockResolvedValue({ usedFallback: true, data: null });

    await expect(enrichAgentNote(job)).rejects.toThrow("模型未返回有效的结构化学习笔记");
    expect(mocks.txNoteUpdateMany).not.toHaveBeenCalled();
  });

  it("marks only the current active generation as failed", async () => {
    await markAgentNoteFailed(job, new Error("provider unavailable"));

    expect(mocks.noteUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "note-1",
        userId: "user-1",
        generationVersion: 2,
        trashedAt: null,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      data: { status: "FAILED", errorMessage: "provider unavailable" },
    });
  });

  it("reconciles old pending and stalled processing notes with bounded batches", async () => {
    mocks.noteFindMany.mockResolvedValue([job]);

    await expect(findAgentNotesNeedingReconciliation()).resolves.toEqual([job]);
    expect(mocks.noteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          trashedAt: null,
          OR: [
            { status: "PENDING", updatedAt: { lt: expect.any(Date) } },
            { status: "PROCESSING", updatedAt: { lt: expect.any(Date) } },
          ],
        },
        take: 100,
      })
    );
  });
});
