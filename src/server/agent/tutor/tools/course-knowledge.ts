import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import { z } from "zod";

import type { TutorQuestionContext } from "@/server/agent/tutor/context/question-context";
import { throwIfAborted, toolText } from "@/server/agent/tutor/tools/tool-utils";
import { searchCourseKnowledge } from "@/server/knowledge/retriever";

const parameters = Type.Object({
  query: Type.String({ minLength: 1, maxLength: 500 }),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
});
const inputSchema = z.object({ query: z.string().trim().min(1).max(500), limit: z.number().int().min(1).max(5).default(3) });

export function createCourseKnowledgeTool(context: TutorQuestionContext): AgentTool<typeof parameters> {
  return {
    name: "search_course_knowledge",
    label: "检索课程知识",
    description: "检索带视频时间戳的公考课程字幕。仅在用户询问概念、标准方法、口诀、课程讲法或同类题迁移规律时调用。官方答案和解析仍是当前题目的最高优先级事实。",
    parameters,
    execute: async (_toolCallId, raw, signal) => {
      throwIfAborted(signal);
      const input = inputSchema.parse(raw);
      try {
        const results = await searchCourseKnowledge({
          query: input.query,
          limit: input.limit,
          questionTagName: context.tagName,
          questionText: context.title,
        });
        return {
          content: [{ type: "text", text: toolText({ results }) }],
          details: { count: results.length, citations: results },
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: "课程知识检索暂时没有返回可用片段，请仅依据当前题目和官方解析回答。" }],
          details: { count: 0, error: error instanceof Error ? error.message : String(error) },
        };
      }
    },
  };
}
