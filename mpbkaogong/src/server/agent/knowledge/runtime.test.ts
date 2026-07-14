import { fauxAssistantMessage, fauxToolCall, registerFauxProvider, streamSimple } from "@mariozechner/pi-ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runKnowledgeAgent } from "@/server/agent/knowledge/runtime";
import { searchCourseKnowledge } from "@/server/knowledge/retriever";

vi.mock("@/server/knowledge/retriever", () => ({ searchCourseKnowledge: vi.fn() }));

describe("runKnowledgeAgent", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "test-model";
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  it("requires retrieval and returns grounded citations", async () => {
    vi.mocked(searchCourseKnowledge).mockResolvedValue([{ 
      chunkId: "chunk-1", sourceId: "source-1", title: "资料分析", quote: "基期量等于现期量除以一加增长率。",
      score: 0.8, bvid: "BV1", partNo: 1, startMs: 1_000, endMs: 3_000, url: "https://example.test",
    }]);
    const faux = registerFauxProvider({ tokensPerSecond: 0 });
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall("search_course_knowledge", { query: "基期量公式" }), { stopReason: "toolUse" }),
      fauxAssistantMessage("基期量用现期量除以一加增长率。[资料1]"),
    ]);
    try {
      const result = await runKnowledgeAgent({
        userId: "user-1",
        sessionId: "session-1",
        messages: [],
        prompt: "基期量怎么算？",
        streamFn: (_model, context, options) => streamSimple(faux.getModel(), context, options),
      });
      expect(result.answer).toContain("[资料1]");
      expect(result.citations).toHaveLength(1);
    } finally {
      faux.unregister();
    }
  });

  it("uses the fixed evidence-insufficient response when retrieval is empty", async () => {
    vi.mocked(searchCourseKnowledge).mockResolvedValue([]);
    const faux = registerFauxProvider({ tokensPerSecond: 0 });
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall("search_course_knowledge", { query: "不存在的内容" }), { stopReason: "toolUse" }),
      fauxAssistantMessage("模型试图补充的内容不应返回。"),
    ]);
    try {
      const result = await runKnowledgeAgent({
        userId: "user-1",
        sessionId: "session-1",
        messages: [],
        prompt: "不存在的内容",
        streamFn: (_model, context, options) => streamSimple(faux.getModel(), context, options),
      });
      expect(result.answer).toContain("没有检索到足够依据");
      expect(result.answer).not.toContain("模型试图");
    } finally {
      faux.unregister();
    }
  });
});
