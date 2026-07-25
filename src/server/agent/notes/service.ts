import type { Prisma } from "@/generated/prisma/client";
import type {
  AgentNoteListResponse,
  AgentNoteReference,
  AgentNoteView,
} from "@/features/agent/agent-note-types";
import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { enqueueAgentNote } from "@/server/agent/notes/queue";
import {
  createAgentNoteSchema,
  listAgentNotesSchema,
  updateAgentNoteSchema,
} from "@/server/agent/notes/schemas";
import { BadRequestError, NotFoundError } from "@/server/services/errors";
import { getPagination } from "@/server/services/pagination";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function unknownArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

type NoteWithTags = Awaited<ReturnType<typeof findOwnedNote>>;

function serializeNote(note: NonNullable<NoteWithTags>): AgentNoteView {
  return {
    id: note.id,
    source: note.source,
    sourceMessageId: note.tutorMessageId ?? note.knowledgeMessageId,
    title: note.aiTitle || note.originalPrompt?.slice(0, 60) || "收藏的 Agent 回答",
    aiMarkdown: note.aiMarkdown,
    keyPoints: stringArray(note.keyPointsJson),
    pitfalls: stringArray(note.pitfallsJson),
    applications: stringArray(note.applicationsJson),
    originalContent: note.originalContent,
    originalPrompt: note.originalPrompt,
    sourceContext: record(note.sourceContextJson),
    citations: unknownArray(note.citationsSnapshotJson),
    userNote: note.userNote,
    status: note.status,
    errorMessage: note.errorMessage,
    generationVersion: note.generationVersion,
    generatedAt: note.generatedAt?.toISOString() ?? null,
    trashedAt: note.trashedAt?.toISOString() ?? null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    tags: note.tags.map((item) => ({
      id: item.tag.id,
      name: item.tag.name,
      attachedBy: item.attachedBy,
    })),
  };
}

function noteReference(note: { id: string; status: "PENDING" | "PROCESSING" | "READY" | "FAILED"; trashedAt: Date | null }): AgentNoteReference {
  return {
    id: note.id,
    status: note.status,
    trashed: note.trashedAt !== null,
  };
}

async function findOwnedNote(userId: string, noteId: string) {
  return prisma.agentNote.findFirst({
    where: { id: noteId, userId },
    include: {
      tags: {
        include: { tag: { select: { id: true, name: true } } },
        orderBy: { attachedAt: "asc" },
      },
    },
  });
}

async function requireOwnedNote(userId: string, noteId: string) {
  const note = await findOwnedNote(userId, noteId);
  if (!note) throw new NotFoundError("学习笔记不存在。");
  return note;
}

async function enqueueCurrent(note: { id: string; userId: string; generationVersion: number }) {
  await enqueueAgentNote({
    noteId: note.id,
    userId: note.userId,
    generationVersion: note.generationVersion,
  });
}

function metadataMessageId(value: unknown) {
  const id = record(value)?.userMessageId;
  return typeof id === "string" ? id : null;
}

async function captureTutorMessage(userId: string, messageId: string) {
  const message = await prisma.agentTutorMessage.findFirst({
    where: { id: messageId, userId },
    include: {
      question: {
        select: {
          id: true,
          plainText: true,
          titleHtml: true,
          tag: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!message) throw new NotFoundError("讲题回答不存在。");
  if (message.role !== "ASSISTANT") throw new BadRequestError("只能收藏 Agent 的回答。");

  const userMessageId = metadataMessageId(message.metadataJson);
  const promptMessage = userMessageId
    ? await prisma.agentTutorMessage.findFirst({
        where: { id: userMessageId, userId, role: "USER" },
        select: { content: true },
      })
    : await prisma.agentTutorMessage.findFirst({
        where: {
          userId,
          questionId: message.questionId,
          sessionId: message.sessionId,
          role: "USER",
          createdAt: { lt: message.createdAt },
        },
        orderBy: { createdAt: "desc" },
        select: { content: true },
      });

  return {
    source: "TUTOR" as const,
    tutorMessageId: message.id,
    knowledgeMessageId: null,
    originalContent: message.content,
    originalPrompt: promptMessage?.content ?? null,
    sourceContextJson: {
      questionId: message.questionId,
      sessionId: message.sessionId,
      questionText: message.question.plainText ?? message.question.titleHtml,
      tag: message.question.tag,
      sourceHref: message.sessionId
        ? `/practice/${message.sessionId}?review=1`
        : `/knowledge?questionId=${encodeURIComponent(message.questionId)}`,
    } satisfies Prisma.InputJsonObject,
    citationsSnapshotJson: [],
  };
}

async function captureKnowledgeMessage(userId: string, messageId: string) {
  const message = await prisma.knowledgeChatMessage.findFirst({
    where: { id: messageId, session: { userId } },
    include: { session: { select: { id: true, title: true } } },
  });
  if (!message) throw new NotFoundError("知识问答回答不存在。");
  if (message.role !== "ASSISTANT") throw new BadRequestError("只能收藏 Agent 的回答。");

  const userMessageId = metadataMessageId(message.metadataJson);
  const promptMessage = userMessageId
    ? await prisma.knowledgeChatMessage.findFirst({
        where: { id: userMessageId, sessionId: message.sessionId, role: "USER" },
        select: { content: true },
      })
    : await prisma.knowledgeChatMessage.findFirst({
        where: {
          sessionId: message.sessionId,
          role: "USER",
          createdAt: { lt: message.createdAt },
        },
        orderBy: { createdAt: "desc" },
        select: { content: true },
      });

  return {
    source: "KNOWLEDGE" as const,
    tutorMessageId: null,
    knowledgeMessageId: message.id,
    originalContent: message.content,
    originalPrompt: promptMessage?.content ?? null,
    sourceContextJson: {
      sessionId: message.session.id,
      sessionTitle: message.session.title,
      sourceHref: `/knowledge?sessionId=${encodeURIComponent(message.session.id)}`,
    } satisfies Prisma.InputJsonObject,
    citationsSnapshotJson: (message.citationsJson ?? []) as Prisma.InputJsonValue,
  };
}

export async function createAgentNote(user: AuthenticatedUser, input: unknown) {
  const data = createAgentNoteSchema.parse(input);
  const uniqueWhere =
    data.source === "TUTOR"
      ? { tutorMessageId: data.messageId }
      : { knowledgeMessageId: data.messageId };
  const existing = await prisma.agentNote.findFirst({
    where: { userId: user.id, ...uniqueWhere },
  });

  if (existing) {
    if (!existing.trashedAt) return noteReference(existing);
    const restored = await prisma.agentNote.update({
      where: { id: existing.id },
      data: {
        trashedAt: null,
        status: "PENDING",
        errorMessage: null,
        generationVersion: { increment: 1 },
      },
    });
    await enqueueCurrent(restored);
    return noteReference(restored);
  }

  const snapshot =
    data.source === "TUTOR"
      ? await captureTutorMessage(user.id, data.messageId)
      : await captureKnowledgeMessage(user.id, data.messageId);

  let created;
  try {
    created = await prisma.agentNote.create({
      data: {
        userId: user.id,
        ...snapshot,
      },
    });
  } catch (error) {
    const concurrent = await prisma.agentNote.findFirst({
      where: { userId: user.id, ...uniqueWhere },
    });
    if (!concurrent) throw error;
    created = concurrent;
  }

  await enqueueCurrent(created);
  return noteReference(created);
}

export async function listAgentNotes(user: AuthenticatedUser, input: unknown): Promise<AgentNoteListResponse> {
  const query = listAgentNotesSchema.parse(input);
  const where: Prisma.AgentNoteWhereInput = {
    userId: user.id,
    trashedAt: query.trashed ? { not: null } : null,
    ...(query.source ? { source: query.source } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.tagId ? { tags: { some: { tagId: query.tagId } } } : {}),
    ...(query.keyword
      ? {
          OR: [
            { aiTitle: { contains: query.keyword } },
            { aiMarkdown: { contains: query.keyword } },
            { originalContent: { contains: query.keyword } },
            { originalPrompt: { contains: query.keyword } },
            { userNote: { contains: query.keyword } },
          ],
        }
      : {}),
  };
  const [total, notes] = await prisma.$transaction([
    prisma.agentNote.count({ where }),
    prisma.agentNote.findMany({
      where,
      include: {
        tags: {
          include: { tag: { select: { id: true, name: true } } },
          orderBy: { attachedAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return {
    items: notes.map(serializeNote),
    pagination: getPagination(query.page, query.pageSize, total),
  };
}

export async function getAgentNote(user: AuthenticatedUser, noteId: string) {
  return serializeNote(await requireOwnedNote(user.id, noteId));
}

async function validLeafTagIds(tagIds: string[]) {
  if (tagIds.length === 0) return [];
  const rows = await prisma.questionTag.findMany({
    where: { id: { in: [...new Set(tagIds)] }, isActive: true, isLeaf: true },
    select: { id: true },
  });
  if (rows.length !== new Set(tagIds).size) {
    throw new BadRequestError("笔记只能关联现有的有效叶子知识点。");
  }
  return rows.map((item) => item.id);
}

export async function updateAgentNote(user: AuthenticatedUser, noteId: string, input: unknown) {
  const data = updateAgentNoteSchema.parse(input);
  await requireOwnedNote(user.id, noteId);
  const humanTagIds = data.humanTagIds ? await validLeafTagIds(data.humanTagIds) : null;

  await prisma.$transaction(async (tx) => {
    if (data.userNote !== undefined) {
      await tx.agentNote.update({
        where: { id: noteId },
        data: { userNote: data.userNote?.trim() || null },
      });
    }
    if (humanTagIds) {
      await tx.agentNoteTag.deleteMany({ where: { noteId, attachedBy: "HUMAN" } });
      for (const tagId of humanTagIds) {
        await tx.agentNoteTag.upsert({
          where: { noteId_tagId: { noteId, tagId } },
          create: { noteId, tagId, attachedBy: "HUMAN" },
          update: { attachedBy: "HUMAN", attachedAt: new Date() },
        });
      }
    }
  });
  return getAgentNote(user, noteId);
}

export async function trashAgentNote(user: AuthenticatedUser, noteId: string) {
  const note = await requireOwnedNote(user.id, noteId);
  const updated = await prisma.agentNote.update({
    where: { id: note.id },
    data: { trashedAt: note.trashedAt ?? new Date() },
  });
  return noteReference(updated);
}

export async function restoreAgentNote(user: AuthenticatedUser, noteId: string) {
  const note = await requireOwnedNote(user.id, noteId);
  const updated = await prisma.agentNote.update({
    where: { id: note.id },
    data: {
      trashedAt: null,
      status: "PENDING",
      errorMessage: null,
      generationVersion: { increment: 1 },
    },
  });
  await enqueueCurrent(updated);
  return noteReference(updated);
}

export async function regenerateAgentNote(user: AuthenticatedUser, noteId: string) {
  const note = await requireOwnedNote(user.id, noteId);
  if (note.trashedAt) throw new BadRequestError("请先从回收站恢复这条笔记。");
  const updated = await prisma.agentNote.update({
    where: { id: note.id },
    data: {
      status: "PENDING",
      errorMessage: null,
      generationVersion: { increment: 1 },
    },
  });
  await enqueueCurrent(updated);
  return noteReference(updated);
}

export async function getAgentNoteReferences(
  userId: string,
  source: "TUTOR" | "KNOWLEDGE",
  messageIds: string[]
) {
  if (messageIds.length === 0) return new Map<string, AgentNoteReference>();
  const notes = await prisma.agentNote.findMany({
    where:
      source === "TUTOR"
        ? { userId, tutorMessageId: { in: messageIds } }
        : { userId, knowledgeMessageId: { in: messageIds } },
    select: {
      id: true,
      status: true,
      trashedAt: true,
      tutorMessageId: true,
      knowledgeMessageId: true,
    },
  });
  return new Map(
    notes.flatMap((note) => {
      const messageId = note.tutorMessageId ?? note.knowledgeMessageId;
      return messageId ? [[messageId, noteReference(note)] as const] : [];
    })
  );
}
