import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import {
  knowledgeCitationSchema,
  type KnowledgeSessionDetail,
  type KnowledgeSessionSummary,
  type KnowledgeUIMessage,
} from "@/features/agent/knowledge-ui-message";
import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { loadKnowledgeConversation } from "@/server/agent/knowledge/context";
import { runKnowledgeAgent } from "@/server/agent/knowledge/runtime";
import type { KnowledgeStreamEvent } from "@/server/agent/knowledge/schemas";
import { NotFoundError } from "@/server/services/errors";

function sessionSummary(session: { id: string; title: string; createdAt: Date; updatedAt: Date }): KnowledgeSessionSummary {
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export async function listKnowledgeSessions(user: AuthenticatedUser) {
  const sessions = await prisma.knowledgeChatSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return sessions.map(sessionSummary);
}

export async function createKnowledgeSession(user: AuthenticatedUser, title?: string) {
  return sessionSummary(
    await prisma.knowledgeChatSession.create({
      data: { userId: user.id, title: title?.trim() || "新知识问答" },
    })
  );
}

export async function deleteKnowledgeSession(user: AuthenticatedUser, sessionId: string) {
  const deleted = await prisma.knowledgeChatSession.deleteMany({ where: { id: sessionId, userId: user.id } });
  if (deleted.count === 0) throw new NotFoundError("知识问答会话不存在。");
  return { id: sessionId };
}

function jsonRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export async function getKnowledgeSession(user: AuthenticatedUser, sessionId: string): Promise<KnowledgeSessionDetail> {
  const session = await prisma.knowledgeChatSession.findFirst({
    where: { id: sessionId, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) throw new NotFoundError("知识问答会话不存在。");
  const messages = session.messages
    .filter((message) => jsonRecord(message.metadataJson)?.status !== "pending")
    .map((message): KnowledgeUIMessage => {
      const parsedCitations = knowledgeCitationSchema.array().safeParse(message.citationsJson);
      const citations = parsedCitations.success ? parsedCitations.data : [];
      const metadata = jsonRecord(message.metadataJson);
      return {
        id: message.id,
        role: message.role === "ASSISTANT" ? "assistant" : "user",
        metadata: {
          createdAt: message.createdAt.toISOString(),
          persistedMessageId: message.id,
          ...(typeof metadata?.durationMs === "number" ? { durationMs: metadata.durationMs } : {}),
        },
        parts: [
          { type: "text", text: message.content },
          ...(citations.length > 0 ? [{ type: "data-citations" as const, data: { items: citations } }] : []),
        ],
      };
    });
  return { ...sessionSummary(session), messages };
}

function defaultSessionTitle(prompt: string) {
  return prompt.replace(/\s+/g, " ").trim().slice(0, 20) || "新知识问答";
}

export async function streamKnowledgeMessage({
  user,
  sessionId,
  prompt,
  emit,
  signal,
}: {
  user: AuthenticatedUser;
  sessionId: string;
  prompt: string;
  emit: (event: KnowledgeStreamEvent) => Promise<void> | void;
  signal?: AbortSignal;
}) {
  const { session, messages } = await loadKnowledgeConversation(user.id, sessionId);
  const turnId = randomUUID();
  const userMessage = await prisma.knowledgeChatMessage.create({
    data: {
      sessionId,
      role: "USER",
      content: prompt,
      metadataJson: { status: "pending", turnId },
    },
  });

  try {
    const result = await runKnowledgeAgent({ userId: user.id, sessionId, messages, prompt, emit, signal });
    const assistant = await prisma.$transaction(async (tx) => {
      const created = await tx.knowledgeChatMessage.create({
        data: {
          sessionId,
          role: "ASSISTANT",
          content: result.answer,
          citationsJson: result.citations as unknown as Prisma.InputJsonValue,
          metadataJson: {
            status: "completed",
            runtime: "pi",
            durationMs: result.durationMs,
            turns: result.turns,
            model: result.model,
            turnId,
            userMessageId: userMessage.id,
          },
        },
      });
      await tx.knowledgeChatMessage.update({
        where: { id: userMessage.id },
        data: { metadataJson: { status: "completed", turnId } },
      });
      await tx.knowledgeChatSession.update({
        where: { id: sessionId },
        data: { title: session.title === "新知识问答" ? defaultSessionTitle(prompt) : session.title },
      });
      return created;
    });
    await emit({ type: "done", messageId: assistant.id, durationMs: result.durationMs });
  } catch (error) {
    await prisma.knowledgeChatMessage.update({
      where: { id: userMessage.id },
      data: { metadataJson: { status: signal?.aborted ? "cancelled" : "failed", turnId } },
    });
    if (!signal?.aborted) await emit({ type: "error", message: error instanceof Error ? error.message : "知识问答失败。" });
  }
}
