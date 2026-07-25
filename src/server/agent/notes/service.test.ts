import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  noteFindFirst: vi.fn(),
  noteCreate: vi.fn(),
  noteUpdate: vi.fn(),
  tutorFindFirst: vi.fn(),
  knowledgeFindFirst: vi.fn(),
  enqueue: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    agentNote: {
      findFirst: mocks.noteFindFirst,
      create: mocks.noteCreate,
      update: mocks.noteUpdate,
    },
    agentTutorMessage: { findFirst: mocks.tutorFindFirst },
    knowledgeChatMessage: { findFirst: mocks.knowledgeFindFirst },
  },
}));

vi.mock("@/server/agent/notes/queue", () => ({
  enqueueAgentNote: mocks.enqueue,
}));

import { createAgentNote } from "@/server/agent/notes/service";

const user = { id: "user-1", role: "USER" as const };
const created = {
  id: "note-1",
  userId: "user-1",
  status: "PENDING" as const,
  trashedAt: null,
  generationVersion: 1,
};

describe("createAgentNote", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.enqueue.mockResolvedValue(true);
  });

  it("captures an owned tutor answer and enqueues enrichment", async () => {
    mocks.noteFindFirst.mockResolvedValue(null);
    mocks.tutorFindFirst
      .mockResolvedValueOnce({
        id: "assistant-1",
        userId: "user-1",
        role: "ASSISTANT",
        content: "讲题回答",
        metadataJson: { userMessageId: "prompt-1" },
        questionId: "question-1",
        sessionId: "session-1",
        createdAt: new Date(),
        question: {
          id: "question-1",
          plainText: "题干",
          titleHtml: "<p>题干</p>",
          tag: { id: "tag-1", name: "增长率" },
        },
      })
      .mockResolvedValueOnce({ content: "为什么选 A？" });
    mocks.noteCreate.mockResolvedValue(created);

    await expect(
      createAgentNote(user, { source: "TUTOR", messageId: "assistant-1" })
    ).resolves.toEqual({ id: "note-1", status: "PENDING", trashed: false });
    expect(mocks.noteCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        tutorMessageId: "assistant-1",
        originalContent: "讲题回答",
        originalPrompt: "为什么选 A？",
      }),
    });
    expect(mocks.enqueue).toHaveBeenCalledWith({
      noteId: "note-1",
      userId: "user-1",
      generationVersion: 1,
    });
  });

  it("returns the existing note instead of creating a duplicate", async () => {
    mocks.noteFindFirst.mockResolvedValue({ ...created, status: "READY" });

    await expect(
      createAgentNote(user, { source: "TUTOR", messageId: "assistant-1" })
    ).resolves.toEqual({ id: "note-1", status: "READY", trashed: false });
    expect(mocks.noteCreate).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("restores a trashed duplicate and increments its generation", async () => {
    mocks.noteFindFirst.mockResolvedValue({ ...created, trashedAt: new Date() });
    mocks.noteUpdate.mockResolvedValue({ ...created, generationVersion: 2 });

    await createAgentNote(user, { source: "TUTOR", messageId: "assistant-1" });

    expect(mocks.noteUpdate).toHaveBeenCalledWith({
      where: { id: "note-1" },
      data: {
        trashedAt: null,
        status: "PENDING",
        errorMessage: null,
        generationVersion: { increment: 1 },
      },
    });
    expect(mocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({ generationVersion: 2 }));
  });

  it("rejects user messages and messages outside the user's ownership", async () => {
    mocks.noteFindFirst.mockResolvedValue(null);
    mocks.tutorFindFirst.mockResolvedValueOnce({
      id: "prompt-1",
      userId: "user-1",
      role: "USER",
      content: "问题",
      question: {},
    });
    await expect(
      createAgentNote(user, { source: "TUTOR", messageId: "prompt-1" })
    ).rejects.toThrow("只能收藏 Agent 的回答");

    mocks.tutorFindFirst.mockResolvedValueOnce(null);
    await expect(
      createAgentNote(user, { source: "TUTOR", messageId: "other-user-answer" })
    ).rejects.toThrow("讲题回答不存在");
  });

  it("captures knowledge citations and the preceding prompt", async () => {
    mocks.noteFindFirst.mockResolvedValue(null);
    mocks.knowledgeFindFirst
      .mockResolvedValueOnce({
        id: "knowledge-answer-1",
        role: "ASSISTANT",
        content: "课程回答",
        metadataJson: { userMessageId: "knowledge-prompt-1" },
        citationsJson: [{ title: "课程一" }],
        sessionId: "knowledge-session-1",
        createdAt: new Date(),
        session: { id: "knowledge-session-1", title: "资料分析" },
      })
      .mockResolvedValueOnce({ content: "基期量怎么算？" });
    mocks.noteCreate.mockResolvedValue({
      ...created,
      id: "knowledge-note-1",
    });

    await createAgentNote(user, {
      source: "KNOWLEDGE",
      messageId: "knowledge-answer-1",
    });

    expect(mocks.noteCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        knowledgeMessageId: "knowledge-answer-1",
        originalPrompt: "基期量怎么算？",
        citationsSnapshotJson: [{ title: "课程一" }],
      }),
    });
  });
});
