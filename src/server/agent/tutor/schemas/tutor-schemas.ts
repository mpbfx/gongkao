import { z } from "zod";

import { agentConfidenceSchema, mistakeCauseSchema } from "@/server/agent/shared/schemas";

export const tutorRequestSchema = z.object({
  sessionId: z.string().min(1).optional(),
  prompt: z.string().trim().min(1).max(500),
  operation: z.enum(["submit", "regenerate"]).default("submit"),
});

export const tutorMistakeReviewSchema = z.object({
  mistakeCause: mistakeCauseSchema,
  confidence: agentConfidenceSchema,
  causeSummary: z.string().trim().min(1).max(800),
  fastestPath: z.string().trim().min(1).max(1_500),
  transferRule: z.string().trim().min(1).max(800),
  suggestedPrompts: z.array(z.string().trim().min(1).max(100)).min(1).max(3),
});

export const tutorReviewSummarySchema = tutorMistakeReviewSchema.omit({ suggestedPrompts: true });

export type TutorMistakeReview = z.infer<typeof tutorMistakeReviewSchema>;

export type TutorStreamEvent =
  | { type: "status"; phase: "thinking" | "tool"; label: string }
  | { type: "token"; content: string }
  | ({ type: "review" } & Omit<TutorMistakeReview, "suggestedPrompts">)
  | { type: "done"; messageId: string; suggestedPrompts: string[]; runtime: "pi"; durationMs: number }
  | { type: "degraded"; reason: string }
  | { type: "error"; message: string };
