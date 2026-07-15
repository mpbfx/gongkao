import type { UIMessage } from "ai";
import { z } from "zod";

export const knowledgeCitationSchema = z.object({
  chunkId: z.string(),
  sourceId: z.string(),
  title: z.string(),
  quote: z.string(),
  score: z.number(),
  bvid: z.string(),
  partNo: z.number(),
  startMs: z.number(),
  endMs: z.number(),
  url: z.string(),
});

export type KnowledgeUIMessage = UIMessage<
  { createdAt?: string; persistedMessageId?: string; durationMs?: number },
  {
    activity: { label: string };
    citations: { items: z.infer<typeof knowledgeCitationSchema>[] };
  }
>;

export type KnowledgeSessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeSessionDetail = KnowledgeSessionSummary & { messages: KnowledgeUIMessage[] };

export function knowledgeMessageText(message: KnowledgeUIMessage) {
  return message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

export function prepareKnowledgeRequest(messages: KnowledgeUIMessage[], operation: "submit" | "regenerate") {
  const userMessage = [...messages].reverse().find((message) => message.role === "user");
  return { prompt: userMessage ? knowledgeMessageText(userMessage) : "", operation };
}
