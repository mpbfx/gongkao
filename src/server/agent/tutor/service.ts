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
  const knowledgeQuery = input.mode === "knowledge"
    ? input.prompt.trim()
    : command.type === "knowledge"
      ? command.query
      : null;
  if (knowledgeQuery !== null && !knowledgeQuery) {
    throw new BusinessError("请输入要检索的课程知识。");
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
    if (knowledgeQuery !== null) {
      await emit({ type: "status", phase: "tool", label: "正在检索课程知识" });
      try {
        const recentUserPrompts = history
          .filter((message) => message.role === "user" && typeof message.content === "string")
          .slice(-3)
          .map((message) => message.content)
          .join("\n");
        forcedKnowledge = await searchCourseKnowledge({
          query: recentUserPrompts ? `${knowledgeQuery}\n相关追问上下文：${recentUserPrompts}` : knowledgeQuery,
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
      prompt: knowledgeQuery ?? (command.type === "chat" ? command.prompt : input.prompt.trim()),
      signal,
      emit,
      requireReview: false,
      enableKnowledge: false,
      forcedKnowledge,
      knowledgeOnly: input.mode === "knowledge",
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
      await emit({ type: "degraded", reason: "AI 模型暂时不可用，请稍后重试。" });
      return;
    }

    if (error instanceof TutorRuntimeError && error.kind === "limit") {
      await emit({ type: "error", message: error.message });
      return;
    }

    if (error instanceof BusinessError) {
      await emit({ type: "error", message: error.message });
      return;
    }

    throw error;
  }
}

export { autoAnalyzeSubmittedSessionMistakes } from "@/server/agent/tutor/auto-review-service";
export type { TutorStreamEvent } from "@/server/agent/tutor/schemas/tutor-schemas";
