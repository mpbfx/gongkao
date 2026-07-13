import type { UIMessage } from "ai";
import { z } from "zod";

import { agentConfidenceSchema, mistakeCauseSchema } from "@/server/agent/shared/schemas";

export const tutorActivitySchema = z.object({
  phase: z.enum(["thinking", "tool"]),
  label: z.string().min(1),
});

export const tutorReviewDataSchema = z.object({
  mistakeCause: mistakeCauseSchema,
  confidence: agentConfidenceSchema,
  causeSummary: z.string().min(1),
  fastestPath: z.string().min(1),
  transferRule: z.string().min(1),
});

export const tutorSuggestionsSchema = z.object({
  items: z.array(z.string().min(1)).max(3),
});

export type TutorMessageMetadata = {
  createdAt?: string;
  persistedMessageId?: string;
  runtime?: "pi";
  durationMs?: number;
};

export type TutorUIData = {
  activity: z.infer<typeof tutorActivitySchema>;
  review: z.infer<typeof tutorReviewDataSchema>;
  suggestions: z.infer<typeof tutorSuggestionsSchema>;
};

export type TutorUIMessage = UIMessage<TutorMessageMetadata, TutorUIData>;

export type TutorHistoryResponse = {
  messages: TutorUIMessage[];
  suggestedPrompts: string[];
};

export function tutorMessageText(message: TutorUIMessage) {
  return message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

export function prepareTutorRequest({
  messages,
  operation,
  sessionId,
}: {
  messages: TutorUIMessage[];
  operation: "submit" | "regenerate";
  sessionId?: string;
}) {
  const userMessage = [...messages].reverse().find((message) => message.role === "user");
  const prompt = userMessage ? tutorMessageText(userMessage) : "";

  return {
    ...(sessionId ? { sessionId } : {}),
    prompt,
    operation,
  };
}
