import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import { z } from "zod";

import { searchCourseKnowledge } from "@/server/knowledge/retriever";
import type { KnowledgeCitation } from "@/server/knowledge/types";

const parameters = Type.Object({
  query: Type.String({ minLength: 1, maxLength: 500 }),
});
const inputSchema = z.object({ query: z.string().trim().min(1).max(500) });

export type KnowledgeSearchState = {
  searched: boolean;
  citations: KnowledgeCitation[];
};

export function createKnowledgeSearchTool(state: KnowledgeSearchState): AgentTool<typeof parameters> {
  return {
    name: "search_course_knowledge",
    label: "检索课程知识",
    description: "检索公考课程字幕。每次回答必须且只能调用一次，并且回答只能使用返回片段中的事实。",
    parameters,
    executionMode: "sequential",
    execute: async (_toolCallId, raw, signal) => {
      if (signal?.aborted) throw new Error("知识检索已取消。");
      if (state.searched) throw new Error("本轮已经完成课程知识检索，不能重复调用。");
      state.searched = true;
      const { query } = inputSchema.parse(raw);
      try {
        state.citations = await searchCourseKnowledge({ query, limit: 3 });
      } catch {
        state.citations = [];
      }

      if (state.citations.length === 0) {
        return {
          content: [{ type: "text", text: "当前课程资料中没有检索到足够依据。最终回答必须说明资料不足，不得使用模型常识补充。" }],
          details: { count: 0 },
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              state.citations.map((item, index) => ({
                citationId: `资料${index + 1}`,
                title: item.title,
                partNo: item.partNo,
                startMs: item.startMs,
                endMs: item.endMs,
                quote: item.quote.slice(0, 800),
                url: item.url,
              }))
            ),
          },
        ],
        details: { count: state.citations.length },
      };
    },
  };
}
