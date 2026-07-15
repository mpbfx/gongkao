import { z } from "zod";

export const knowledgeMessageRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(500),
  operation: z.enum(["submit", "regenerate"]).default("submit"),
});

export const createKnowledgeSessionSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
});

export type KnowledgeStreamEvent =
  | { type: "status"; label: string }
  | { type: "token"; content: string }
  | { type: "citations"; citations: import("@/server/knowledge/types").KnowledgeCitation[] }
  | { type: "done"; messageId: string; durationMs: number }
  | { type: "error"; message: string };
