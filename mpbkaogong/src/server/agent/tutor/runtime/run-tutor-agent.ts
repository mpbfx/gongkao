import type { AgentEvent, AgentMessage, StreamFn } from "@mariozechner/pi-agent-core";
import type { AssistantMessage } from "@mariozechner/pi-ai";

import type { TutorQuestionContext } from "@/server/agent/tutor/context/question-context";
import { createTutorAgent } from "@/server/agent/tutor/runtime/create-tutor-agent";
import { tutorRuntimeLimits } from "@/server/agent/tutor/runtime/runtime-limits";
import type { TutorStreamEvent } from "@/server/agent/tutor/schemas/tutor-schemas";
import type { TutorMistakeReview } from "@/server/agent/tutor/schemas/tutor-schemas";

export class TutorRuntimeError extends Error {
  constructor(
    message: string,
    public kind: "provider" | "limit" | "invalid_result" | "cancelled"
  ) {
    super(message);
    this.name = "TutorRuntimeError";
  }
}

type Emit = (event: TutorStreamEvent) => Promise<void> | void;

const toolLabels: Record<string, string> = {
  get_learner_mistake_patterns: "正在读取个人错题模式",
  get_previous_reviews: "正在读取历史错因复盘",
  search_related_questions: "正在检索同类题",
  submit_mistake_review: "正在整理本题复盘",
};

function assistantText(message: AssistantMessage) {
  return message.content
    .filter((item): item is Extract<(typeof message.content)[number], { type: "text" }> => item.type === "text")
    .map((item) => item.text)
    .join("")
    .trim();
}

function finalAssistant(messages: AgentMessage[]) {
  return [...messages]
    .reverse()
    .find((message): message is AssistantMessage => message.role === "assistant" && message.stopReason === "stop");
}

function totalTokens(messages: AgentMessage[]) {
  return messages.reduce((total, message) => total + (message.role === "assistant" ? message.usage.totalTokens : 0), 0);
}

export async function runTutorAgent({
  userId,
  context,
  messages,
  prompt,
  signal,
  emit = () => undefined,
  streamFn,
}: {
  userId: string;
  context: TutorQuestionContext;
  messages: AgentMessage[];
  prompt: string;
  signal?: AbortSignal;
  emit?: Emit;
  streamFn?: StreamFn;
}) {
  if (signal?.aborted) throw new TutorRuntimeError("讲解已取消。", "cancelled");
  const startedAt = Date.now();
  const { agent, counters, reviewSubmission } = createTutorAgent({ userId, context, messages, streamFn });
  let timedOut = false;
  let limited = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    agent.abort();
  }, tutorRuntimeLimits.timeoutMs);
  const onAbort = () => agent.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) agent.abort();

  const unsubscribe = agent.subscribe(async (event) => {
    await handleAgentEvent(event, emit, () => reviewSubmission.value, () => {
      counters.turns += 1;
      if (counters.turns > tutorRuntimeLimits.maxTurns) {
        limited = true;
        agent.abort();
      }
    });
  });

  try {
    await agent.prompt(prompt);
  } catch (error) {
    if (signal?.aborted) throw new TutorRuntimeError("讲解已取消。", "cancelled");
    if (timedOut || limited) throw new TutorRuntimeError("讲解执行超过安全限制，请缩短问题后重试。", "limit");
    throw new TutorRuntimeError(error instanceof Error ? error.message : "模型调用失败。", "provider");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
    unsubscribe();
  }

  if (agent.state.errorMessage) {
    const kind = signal?.aborted ? "cancelled" : timedOut || limited ? "limit" : "provider";
    throw new TutorRuntimeError(agent.state.errorMessage, kind);
  }
  if (counters.toolCalls > tutorRuntimeLimits.maxToolCalls || counters.turns > tutorRuntimeLimits.maxTurns) {
    throw new TutorRuntimeError("讲解执行超过安全限制。", "limit");
  }

  const finalMessage = finalAssistant(agent.state.messages);
  const answer = finalMessage ? assistantText(finalMessage) : "";
  if (!answer || !reviewSubmission.value) {
    throw new TutorRuntimeError("模型没有生成完整回答和结构化复盘。", "invalid_result");
  }

  return {
    answer,
    review: reviewSubmission.value,
    durationMs: Date.now() - startedAt,
    turns: counters.turns,
    toolNames: [...counters.toolNames],
    totalTokens: totalTokens(agent.state.messages.slice(messages.length)),
    model: agent.state.model.id,
  };
}

async function handleAgentEvent(
  event: AgentEvent,
  emit: Emit,
  getReview: () => TutorMistakeReview | undefined,
  onTurn: () => void
) {
  if (event.type === "turn_start") {
    onTurn();
    await emit({ type: "status", phase: "thinking", label: "正在理解你的问题" });
  }
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta" && getReview()) {
    await emit({ type: "token", content: event.assistantMessageEvent.delta });
  }
  if (event.type === "tool_execution_start") {
    await emit({ type: "status", phase: "tool", label: toolLabels[event.toolName] ?? "正在查询学习数据" });
  }
  const review = getReview();
  if (
    event.type === "tool_execution_end" &&
    event.toolName === "submit_mistake_review" &&
    !event.isError &&
    review
  ) {
    await emit({
      type: "review",
      mistakeCause: review.mistakeCause,
      confidence: review.confidence,
      causeSummary: review.causeSummary,
      fastestPath: review.fastestPath,
      transferRule: review.transferRule,
    });
  }
}
