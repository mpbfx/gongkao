import { z } from "zod";

import { agentNoteSourceSchema, agentNoteStatusSchema } from "@/features/agent/agent-note-types";
import { emptyStringToUndefined, paginationQuerySchema } from "@/server/services/pagination";

export const createAgentNoteSchema = z.object({
  source: agentNoteSourceSchema,
  messageId: z.string().min(1),
});

export const listAgentNotesSchema = paginationQuerySchema.extend({
  keyword: z.preprocess(emptyStringToUndefined, z.string().trim().max(100).optional()),
  source: z.preprocess(emptyStringToUndefined, agentNoteSourceSchema.optional()),
  status: z.preprocess(emptyStringToUndefined, agentNoteStatusSchema.optional()),
  tagId: z.preprocess(emptyStringToUndefined, z.string().optional()),
  trashed: z.preprocess(
    emptyStringToUndefined,
    z.enum(["true", "false"]).default("false").transform((value) => value === "true")
  ),
});

export const updateAgentNoteSchema = z
  .object({
    userNote: z.string().max(20_000).nullable().optional(),
    humanTagIds: z.array(z.string().min(1)).max(20).optional(),
  })
  .refine((value) => value.userNote !== undefined || value.humanTagIds !== undefined, {
    message: "至少提供一个需要更新的字段",
  });

export const agentNoteGenerationSchema = z.object({
  title: z.string().trim().min(2).max(60),
  markdown: z.string().trim().min(1).max(20_000),
  keyPoints: z.array(z.string().trim().min(1).max(300)).min(1).max(6),
  pitfalls: z.array(z.string().trim().min(1).max(300)).max(5),
  applications: z.array(z.string().trim().min(1).max(300)).max(5),
  tagIds: z.array(z.string()).max(8),
});

export type AgentNoteGeneration = z.infer<typeof agentNoteGenerationSchema>;
