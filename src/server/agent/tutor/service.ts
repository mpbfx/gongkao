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
import { parseTutorCommand } from "@/server/agent/tutor/tutor-command";
import { searchCourseKnowledge } from "@/server/knowledge/retriever";
import type { KnowledgeSearchResult } from "@/server/knowledge/types";
import { BusinessError } from "@/server/services/errors";

type Emit = (event: TutorStreamEvent) => Promise<void> | void;

async function executeTutorTurn(input: TutorInput, emit: Emit, signal?: AbortSignal) {
  const context = await loadTutorQuestionContext(input);
  const history = await loadConversationMessages(input.user.id, input.questionId, input.sessionId);
  const command = parseTutorCommand(input.prompt);
  if (command.type === "knowledge" && !command.query) {
    throw new BusinessError("请输入知识库检索内容，例如：/knowledge 资料分析题速算");
  }
  const turnId = randomUUID();
  const userMessage = await beginTutorTurn({
    userId: input.user.id,
    questionId: input.questionId,
    sessionId: context.sessionId,
    prompt: input.prompt,
    turnId,
  });

  try {
    let forcedKnowledge: KnowledgeSearchResult[] | undefined;
    if (command.type === "knowledge") {
      await emit({ type: "status", phase: "tool", label: "正在检索课程知识" });
      try {
        forcedKnowledge = await searchCourseKnowledge({
          query: command.query,
          limit: 3,
          questionTagName: context.tagName,
          questionText: context.title,
        });
      } catch {
        forcedKnowledge = [];
      }
    }
    const result = await runTutorAgent({
      userId: input.user.id,
      context,
      messages: history,
      prompt: command.type === "knowledge" ? command.query : command.prompt,
      signal,
      emit,
      requireReview: false,
      enableKnowledge: false,
      forcedKnowledge,
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
