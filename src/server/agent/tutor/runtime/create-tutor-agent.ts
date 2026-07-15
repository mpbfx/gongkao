import { Agent, type AgentMessage, type AgentOptions, type StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";

import type { TutorQuestionContext } from "@/server/agent/tutor/context/question-context";
import { trimConversationContext } from "@/server/agent/tutor/context/conversation-context";
import { getTutorApiKey, createTutorModel } from "@/server/agent/tutor/models/pi-model";
import { buildTutorSystemPrompt } from "@/server/agent/tutor/prompts/tutor-system-prompt";
import { tutorRuntimeLimits } from "@/server/agent/tutor/runtime/runtime-limits";
import { createCourseKnowledgeTool } from "@/server/agent/tutor/tools/course-knowledge";
import { createLearnerPatternsTool } from "@/server/agent/tutor/tools/learner-patterns";
import { createPreviousReviewsTool } from "@/server/agent/tutor/tools/previous-reviews";
import { createRelatedQuestionsTool } from "@/server/agent/tutor/tools/related-questions";
import {
  createSubmitMistakeReviewTool,
  type ReviewSubmission,
} from "@/server/agent/tutor/tools/submit-mistake-review";

export type TutorRuntimeCounters = {
  turns: number;
  toolCalls: number;
  toolNames: Set<string>;
  responseStatus?: number;
};

function runtimeStreamFn(): StreamFn {
  return (model, context, options) =>
    streamSimple(model, context, {
      ...options,
      maxRetries: 0,
      timeoutMs: tutorRuntimeLimits.timeoutMs,
    });
}

export function createTutorAgent({
  userId,
  context,
  messages,
  streamFn,
  enableKnowledge = true,
  requireReview = true,
}: {
  userId: string;
  context: TutorQuestionContext;
  messages: AgentMessage[];
  streamFn?: StreamFn;
  enableKnowledge?: boolean;
  requireReview?: boolean;
}) {
  const reviewSubmission: ReviewSubmission = {};
  const counters: TutorRuntimeCounters = { turns: 0, toolCalls: 0, toolNames: new Set() };
  const tools = [
    createLearnerPatternsTool(userId, context),
    createPreviousReviewsTool(userId, context),
    createRelatedQuestionsTool(context),
  ];
  if (enableKnowledge) tools.push(createCourseKnowledgeTool(context));
  if (requireReview) tools.push(createSubmitMistakeReviewTool(context, reviewSubmission));
  const options: AgentOptions = {
    initialState: {
      systemPrompt: buildTutorSystemPrompt(context, { requireReview }),
      model: createTutorModel(),
      thinkingLevel: "off",
      tools,
      messages,
    },
    transformContext: trimConversationContext,
    streamFn: streamFn ?? runtimeStreamFn(),
    getApiKey: getTutorApiKey,
    toolExecution: "sequential",
    maxRetryDelayMs: 3_000,
    sessionId: `${userId}:${context.questionId}:${context.sessionId ?? "wrong"}`,
    beforeToolCall: async ({ toolCall }) => {
      counters.toolCalls += 1;
      counters.toolNames.add(toolCall.name);

      if (counters.toolCalls > tutorRuntimeLimits.maxToolCalls) {
        return { block: true, reason: "本次讲解的工具调用次数已达到上限，请直接结束回答。" };
      }
    },
    onResponse: (response) => {
      counters.responseStatus = response.status;
    },
  };

  return { agent: new Agent(options), counters, reviewSubmission };
}
