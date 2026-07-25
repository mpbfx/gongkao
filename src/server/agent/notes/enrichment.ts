import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AgentNoteJobData } from "@/server/agent/notes/queue";
import { agentNoteGenerationSchema } from "@/server/agent/notes/schemas";
import { generateStructuredResponseWithStatus } from "@/server/agent/shared/llm";

const emptyGeneration = {
  title: "收藏的 Agent 回答",
  markdown: "归纳暂时不可用。",
  keyPoints: ["请稍后重试归纳。"],
  pitfalls: [],
  applications: [],
  tagIds: [],
};

function textFromJson(value: unknown) {
  if (!value || typeof value !== "object") return "";
  return JSON.stringify(value);
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "自动归纳失败";
  return message.slice(0, 1_000);
}

export function filterAllowedAgentNoteTagIds(tagIds: string[], allowedTagIds: Set<string>) {
  return [...new Set(tagIds.filter((id) => allowedTagIds.has(id)))];
}

export async function enrichAgentNote(data: AgentNoteJobData) {
  const note = await prisma.agentNote.findFirst({
    where: {
      id: data.noteId,
      userId: data.userId,
      generationVersion: data.generationVersion,
      trashedAt: null,
    },
  });
  if (!note || (note.status === "READY" && note.generationVersion === data.generationVersion)) {
    return { skipped: true };
  }

  await prisma.agentNote.updateMany({
    where: {
      id: note.id,
      userId: data.userId,
      generationVersion: data.generationVersion,
      trashedAt: null,
    },
    data: { status: "PROCESSING", errorMessage: null },
  });

  const tags = await prisma.questionTag.findMany({
    where: { isActive: true, isLeaf: true },
    orderBy: [{ path: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    take: 500,
    select: { id: true, name: true, path: true },
  });
  const allowedTagIds = new Set(tags.map((tag) => tag.id));
  const input = [
    `用户问题：${note.originalPrompt ?? "未记录"}`,
    `Agent 回答：\n${note.originalContent}`,
    `来源上下文：${textFromJson(note.sourceContextJson)}`,
    `引用：${textFromJson(note.citationsSnapshotJson)}`,
    `可选知识点（只能返回其中的 id）：\n${tags
      .map((tag) => `${tag.id}\t${tag.path || tag.name}`)
      .join("\n")}`,
  ].join("\n\n");

  const result = await generateStructuredResponseWithStatus({
    schema: agentNoteGenerationSchema,
    name: "agent_learning_note",
    instructions: [
      "你是公考学习笔记编辑。根据用户问题和 Agent 回答整理一张可复习的学习卡。",
      "title 要具体；markdown 使用自然中文，保留必要公式和推理；不要虚构来源中没有的信息。",
      "keyPoints 提炼可迁移的规则；pitfalls 只写真实易错点；applications 说明适用题型或场景。",
      "tagIds 只能从提供的有效叶子知识点 id 中选择；无法可靠匹配时返回空数组。",
    ].join("\n"),
    input,
    fallback: emptyGeneration,
  });
  if (result.usedFallback) {
    throw new Error("模型未返回有效的结构化学习笔记");
  }

  const generated = result.data;
  const aiTagIds = filterAllowedAgentNoteTagIds(generated.tagIds, allowedTagIds);
  // The AI/HUMAN replacement boundary follows Karakeep's tag-attachment
  // transaction pattern (AGPL-3.0), audited at
  // bc50630767079b060488d1d790b96de1e06ea6ba. See NOTICE.
  const persisted = await prisma.$transaction(async (tx) => {
    const updated = await tx.agentNote.updateMany({
      where: {
        id: note.id,
        userId: data.userId,
        generationVersion: data.generationVersion,
        trashedAt: null,
        status: "PROCESSING",
      },
      data: {
        aiTitle: generated.title,
        aiMarkdown: generated.markdown,
        keyPointsJson: generated.keyPoints as Prisma.InputJsonValue,
        pitfallsJson: generated.pitfalls as Prisma.InputJsonValue,
        applicationsJson: generated.applications as Prisma.InputJsonValue,
        status: "READY",
        errorMessage: null,
        generatedAt: new Date(),
      },
    });
    if (updated.count === 0) return false;

    await tx.agentNoteTag.deleteMany({
      where: { noteId: note.id, attachedBy: "AI" },
    });
    const humanTags = await tx.agentNoteTag.findMany({
      where: { noteId: note.id, attachedBy: "HUMAN", tagId: { in: aiTagIds } },
      select: { tagId: true },
    });
    const humanTagIds = new Set(humanTags.map((item) => item.tagId));
    const newAiTagIds = aiTagIds.filter((id) => !humanTagIds.has(id));
    if (newAiTagIds.length > 0) {
      await tx.agentNoteTag.createMany({
        data: newAiTagIds.map((tagId) => ({
          noteId: note.id,
          tagId,
          attachedBy: "AI" as const,
        })),
        skipDuplicates: true,
      });
    }
    return true;
  });

  return { skipped: !persisted };
}

export async function markAgentNoteFailed(data: AgentNoteJobData, error: unknown) {
  await prisma.agentNote.updateMany({
    where: {
      id: data.noteId,
      userId: data.userId,
      generationVersion: data.generationVersion,
      trashedAt: null,
      status: { in: ["PENDING", "PROCESSING"] },
    },
    data: { status: "FAILED", errorMessage: errorMessage(error) },
  });
}

export async function findAgentNotesNeedingReconciliation() {
  const now = Date.now();
  return prisma.agentNote.findMany({
    where: {
      trashedAt: null,
      OR: [
        { status: "PENDING", updatedAt: { lt: new Date(now - 30_000) } },
        { status: "PROCESSING", updatedAt: { lt: new Date(now - 10 * 60_000) } },
      ],
    },
    take: 100,
    select: { id: true, userId: true, generationVersion: true },
  });
}

export function agentNoteFailureMessage(error: unknown) {
  return errorMessage(error);
}
