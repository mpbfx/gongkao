import { randomUUID } from "node:crypto";

import type { AuthenticatedUser } from "@/lib/auth/guards";
import { loadConversationMessages } from "@/server/agent/tutor/context/conversation-context";
import {
  loadTutorQuestionContext,
  type TutorInput,
} from "@/server/agent/tutor/context/question-context";
import { TutorModelUnavailableError } from "@/server/agent/tutor/models/pi-model";
import {
  beginTutorTurn,
  getTutorHistory,
  markTutorTurn,
  persistTutorChatSuccess,
} from "@/server/agent/tutor/persistence/messages";
import { runTutorAgent, TutorRuntimeError } from "@/server/agent/tutor/runtime/run-tutor-agent";
import { type TutorStreamEvent } from "@/server/agent/tutor/schemas/tutor-schemas";

type Emit = (event: TutorStreamEvent) => Promise<void> | void;

async function executeTutorTurn(input: TutorInput, emit: Emit, signal?: AbortSignal) {
  const context = await loadTutorQuestionContext(input);
  const history = await loadConversationMessages(input.user.id, input.questionId, input.sessionId);
  const turnId = randomUUID();
  const userMessage = await beginTutorTurn({
    userId: input.user.id,
    questionId: input.questionId,
    sessionId: context.sessionId,
    prompt: input.prompt,
    turnId,
  });

  try {
    const result = await runTutorAgent({
      userId: input.user.id,
      context,
      messages: history,
      prompt: input.prompt,
      signal,
      emit,
      requireReview: false,
    });
    const assistantMessage = await persistTutorChatSuccess({
      userId: input.user.id,
      context,
      answer: result.answer,
      userMessageId: userMessage.id,
      runtime: { ...result, turnId },
    });

    await emit({
      type: "done",
      messageId: assistantMessage.id,
      suggestedPrompts: ["为什么不选我选的这个？", "有没有更快的做法？", "这类题下次怎么判断？"],
      runtime: "pi",
      durationMs: result.durationMs,
    });

  } catch (error) {
    const cancelled = signal?.aborted || (error instanceof TutorRuntimeError && error.kind === "cancelled");
    await markTutorTurn(
      userMessage.id,
      turnId,
      cancelled ? "cancelled" : "failed",
      error instanceof Error ? error.name : "UnknownError"
    );
    throw error;
  }
}

export function getQuestionTutorHistory({
  user,
  questionId,
  sessionId,
}: {
  user: AuthenticatedUser;
  questionId: string;
  sessionId?: string;
}) {
  return getTutorHistory(user.id, questionId, sessionId);
}

export async function streamQuestionWithTutor(input: TutorInput, emit: Emit, signal?: AbortSignal) {
  try {
    await executeTutorTurn(input, emit, signal);
  } catch (error) {
    if (signal?.aborted || (error instanceof TutorRuntimeError && error.kind === "cancelled")) return;

    if (
      error instanceof TutorModelUnavailableError ||
      (error instanceof TutorRuntimeError && (error.kind === "provider" || error.kind === "invalid_result"))
    ) {
      await emit({ type: "degraded", reason: "AI 模型暂时不可用，本次没有生成模板替代答案。" });
      return;
    }

    if (error instanceof TutorRuntimeError && error.kind === "limit") {
      await emit({ type: "error", message: error.message });
      return;
    }

    throw error;
  }
}

export { autoAnalyzeSubmittedSessionMistakes } from "@/server/agent/tutor/auto-review-service";
export type { TutorStreamEvent } from "@/server/agent/tutor/schemas/tutor-schemas";
