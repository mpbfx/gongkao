import type { AgentMessage, StreamFn } from "@mariozechner/pi-agent-core";
import {
  fauxAssistantMessage,
  fauxToolCall,
  registerFauxProvider,
  streamSimple,
} from "@mariozechner/pi-ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { TutorQuestionContext } from "@/server/agent/tutor/context/question-context";
import { runTutorAgent } from "@/server/agent/tutor/runtime/run-tutor-agent";
import type { TutorStreamEvent } from "@/server/agent/tutor/schemas/tutor-schemas";

const context = {
  questionId: "question-1",
  sessionId: "session-1",
  practiceAnswerId: "answer-1",
  title: "下列哪项正确？",
  material: "",
  options: [
    { label: "A", value: "A", content: "正确项" },
    { label: "B", value: "B", content: "干扰项" },
  ],
  correctAnswer: "A",
  analysis: "B 只满足局部条件。",
  userAnswer: "B",
  tagId: "tag-1",
  tagName: "判断推理",
  questionType: "SINGLE",
  difficulty: "MEDIUM",
  source: null,
  wrongCount: 1,
  timeSpentSeconds: 50,
  sessionAverageTimeSeconds: 45,
  userAverageTimeSeconds: 48,
  tagAverageTimeSeconds: 46,
  hasOfficialAnalysis: true,
  hasImageContent: false,
} satisfies TutorQuestionContext;

const reviewArguments = {
  mistakeCause: "OPTION_TRAP",
  confidence: "MEDIUM",
  causeSummary: "被只满足局部条件的 B 吸引。",
  fastestPath: "先核对题干全部限定条件。",
  transferRule: "局部正确不等于满足题干全部条件。",
  suggestedPrompts: ["如何快速识别这种干扰项？"],
};

describe("runTutorAgent", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "test-model";
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  it("uses Pi tool calling and produces one answer with one structured review", async () => {
    const faux = registerFauxProvider({ tokensPerSecond: 0 });
    const history: AgentMessage[] = [{ role: "user", content: "你刚才说先看限定条件", timestamp: 1 }];
    faux.setResponses([
      (agentContext) => {
        expect(agentContext.messages.some((message) => message.role === "user" && message.content === history[0].content)).toBe(true);
        return fauxAssistantMessage(fauxToolCall("submit_mistake_review", reviewArguments), {
          stopReason: "toolUse",
        });
      },
      fauxAssistantMessage("B 的问题是只满足局部条件；回到题干逐项核对即可。"),
    ]);
    const streamFn: StreamFn = (_model, agentContext, options) =>
      streamSimple(faux.getModel(), agentContext, options);
    const events: TutorStreamEvent[] = [];

    try {
      const result = await runTutorAgent({
        userId: "user-1",
        context,
        messages: history,
        prompt: "刚才第二步是什么意思？",
        streamFn,
        emit: (event) => {
          events.push(event);
        },
      });

      expect(result.answer).toContain("局部条件");
      expect(result.review.mistakeCause).toBe("OPTION_TRAP");
      expect(result.toolNames).toEqual(["submit_mistake_review"]);
      expect(events.some((event) => event.type === "review")).toBe(true);
      expect(events.filter((event) => event.type === "token").map((event) => event.content).join(""))
        .toContain("回到题干");
    } finally {
      faux.unregister();
    }
  });

  it("rejects a model answer that did not submit a structured review", async () => {
    const faux = registerFauxProvider({ tokensPerSecond: 0 });
    faux.setResponses([fauxAssistantMessage("只有自然语言，没有结构化复盘。")]);
    const streamFn: StreamFn = (_model, agentContext, options) =>
      streamSimple(faux.getModel(), agentContext, options);

    try {
      await expect(
        runTutorAgent({ userId: "user-1", context, messages: [], prompt: "讲讲这题", streamFn })
      ).rejects.toMatchObject({ kind: "invalid_result" });
    } finally {
      faux.unregister();
    }
  });

  it("stops runs that exceed the tool-call limit", async () => {
    const faux = registerFauxProvider({ tokensPerSecond: 0 });
    const calls = Array.from({ length: 7 }, (_, index) =>
      fauxToolCall("submit_mistake_review", reviewArguments, { id: `review-${index}` })
    );
    faux.setResponses([
      fauxAssistantMessage(calls, { stopReason: "toolUse" }),
      fauxAssistantMessage("这段回答不应被接受。"),
    ]);
    const streamFn: StreamFn = (_model, agentContext, options) =>
      streamSimple(faux.getModel(), agentContext, options);

    try {
      await expect(
        runTutorAgent({ userId: "user-1", context, messages: [], prompt: "讲讲这题", streamFn })
      ).rejects.toMatchObject({ kind: "limit" });
    } finally {
      faux.unregister();
    }
  });

  it("honors an already-cancelled request without starting the model", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      runTutorAgent({ userId: "user-1", context, messages: [], prompt: "讲讲这题", signal: controller.signal })
    ).rejects.toMatchObject({ kind: "cancelled" });
  });
});
