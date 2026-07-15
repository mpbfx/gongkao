import type { Prisma } from "@/generated/prisma/client";
import type { TutorHistoryResponse, TutorUIMessage } from "@/features/agent/tutor-ui-message";
import { prisma } from "@/lib/db/prisma";
import type { TutorQuestionContext } from "@/server/agent/tutor/context/question-context";
import { replaceLatestMistakeReview } from "@/server/agent/tutor/persistence/mistake-reviews";
import {
  tutorReviewSummarySchema,
  type TutorMistakeReview,
} from "@/server/agent/tutor/schemas/tutor-schemas";

type RuntimeMetadata = {
  turnId: string;
  durationMs: number;
  turns: number;
  toolNames: string[];
  totalTokens: number;
  model: string;
};

export async function beginTutorTurn({
  userId,
  questionId,
  sessionId,
  prompt,
  turnId,
}: {
  userId: string;
  questionId: string;
  sessionId?: string;
  prompt: string;
  turnId: string;
}) {
  return prisma.agentTutorMessage.create({
    data: {
      userId,
      questionId,
      sessionId,
      role: "USER",
      content: prompt,
      metadataJson: { runtime: "pi", turnId, status: "pending" },
    },
  });
}

export async function markTutorTurn(
  userMessageId: string,
  turnId: string,
  status: "completed" | "failed" | "cancelled",
  errorType?: string
) {
  await prisma.agentTutorMessage.update({
    where: { id: userMessageId },
    data: { metadataJson: { runtime: "pi", turnId, status, ...(errorType ? { errorType } : {}) } },
  });
}

export async function persistTutorSuccess({
  userId,
  context,
  answer,
  review,
  runtime,
  userMessageId,
}: {
  userId: string;
  context: TutorQuestionContext;
  answer: string;
  review: TutorMistakeReview;
  runtime: RuntimeMetadata;
  userMessageId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const assistantMessage = await tx.agentTutorMessage.create({
      data: {
        userId,
        questionId: context.questionId,
        sessionId: context.sessionId,
        role: "ASSISTANT",
        content: answer,
        metadataJson: {
          runtime: "pi",
          status: "completed",
          ...runtime,
          userMessageId,
          ...review,
        } as Prisma.InputJsonValue,
      },
    });

    await replaceLatestMistakeReview(tx, {
      userId,
      context,
      review,
      tutorMessageId: assistantMessage.id,
    });
    await tx.agentTutorMessage.update({
      where: { id: userMessageId },
      data: { metadataJson: { runtime: "pi", turnId: runtime.turnId, status: "completed" } },
    });

    return assistantMessage;
  });
}

export async function persistTutorChatSuccess({
  userId,
  context,
  answer,
  runtime,
  userMessageId,
}: {
  userId: string;
  context: TutorQuestionContext;
  answer: string;
  runtime: RuntimeMetadata;
  userMessageId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const assistantMessage = await tx.agentTutorMessage.create({
      data: {
        userId,
        questionId: context.questionId,
        sessionId: context.sessionId,
        role: "ASSISTANT",
        content: answer,
        metadataJson: {
          runtime: "pi",
          status: "completed",
          ...runtime,
          userMessageId,
        } as Prisma.InputJsonValue,
      },
    });
    await tx.agentTutorMessage.update({
      where: { id: userMessageId },
      data: { metadataJson: { runtime: "pi", turnId: runtime.turnId, status: "completed" } },
    });
    return assistantMessage;
  });
}

function metadataRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function completedOrLegacy(value: unknown) {
  const status = metadataRecord(value)?.status;
  return typeof status !== "string" || status === "completed";
}

function reviewFromMetadata(value: unknown) {
  const metadata = metadataRecord(value);
  if (!metadata) return null;
  const parsed = tutorReviewSummarySchema.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}

export async function getTutorHistory(userId: string, questionId: string, sessionId?: string) {
  const rows = await prisma.agentTutorMessage.findMany({
    where: { userId, questionId, ...(sessionId ? { sessionId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const messages = rows.reverse().filter((message) => completedOrLegacy(message.metadataJson));
  const latestAssistant = [...messages].reverse().find((message) => message.role === "ASSISTANT");
  const metadata = metadataRecord(latestAssistant?.metadataJson);

  return {
    messages: messages.map((message) => {
      const review = message.role === "ASSISTANT" ? reviewFromMetadata(message.metadataJson) : null;
      const runtime = metadataRecord(message.metadataJson);
      const parts: TutorUIMessage["parts"] = [
        ...(review ? [{ type: "data-review" as const, data: review }] : []),
        { type: "text" as const, text: message.content },
      ];

      return {
        id: message.id,
        role: message.role === "ASSISTANT" ? "assistant" : "user",
        metadata: {
          createdAt: message.createdAt.toISOString(),
          persistedMessageId: message.id,
          ...(runtime?.runtime === "pi" ? { runtime: "pi" as const } : {}),
          ...(typeof runtime?.durationMs === "number" ? { durationMs: runtime.durationMs } : {}),
        },
        parts,
      } satisfies TutorUIMessage;
    }),
    suggestedPrompts: Array.isArray(metadata?.suggestedPrompts)
      ? metadata.suggestedPrompts.filter((item): item is string => typeof item === "string")
      : [],
  } satisfies TutorHistoryResponse;
}
