import { z } from "zod";

export const agentNoteSourceSchema = z.enum(["TUTOR", "KNOWLEDGE"]);
export const agentNoteStatusSchema = z.enum(["PENDING", "PROCESSING", "READY", "FAILED"]);

export type AgentNoteSource = z.infer<typeof agentNoteSourceSchema>;
export type AgentNoteStatus = z.infer<typeof agentNoteStatusSchema>;

export type AgentNoteReference = {
  id: string;
  status: AgentNoteStatus;
  trashed: boolean;
};

export type AgentNoteTagView = {
  id: string;
  name: string;
  attachedBy: "AI" | "HUMAN";
};

export type AgentNoteView = {
  id: string;
  source: AgentNoteSource;
  sourceMessageId: string | null;
  title: string;
  aiMarkdown: string | null;
  keyPoints: string[];
  pitfalls: string[];
  applications: string[];
  originalContent: string;
  originalPrompt: string | null;
  sourceContext: Record<string, unknown> | null;
  citations: unknown[];
  userNote: string | null;
  status: AgentNoteStatus;
  errorMessage: string | null;
  generationVersion: number;
  generatedAt: string | null;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: AgentNoteTagView[];
};

export type AgentNoteListResponse = {
  items: AgentNoteView[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
