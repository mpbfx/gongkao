import { z } from "zod";

const integerFromEnv = z.coerce.number().int().positive();

function optionalTrimmed(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export type KnowledgeConfig = ReturnType<typeof loadKnowledgeConfig>;

export function loadKnowledgeConfig() {
  const embeddingModel = optionalTrimmed(process.env.EMBEDDING_MODEL);
  const embeddingDimensions = optionalTrimmed(process.env.EMBEDDING_DIMENSIONS);
  const apiKey = optionalTrimmed(process.env.EMBEDDING_API_KEY) ?? optionalTrimmed(process.env.OPENAI_API_KEY);

  if (!embeddingModel || !embeddingDimensions || !apiKey) {
    throw new Error("知识库需要配置 EMBEDDING_MODEL、EMBEDDING_DIMENSIONS 和 Embedding API Key。");
  }

  return {
    qdrantUrl: optionalTrimmed(process.env.QDRANT_URL) ?? "http://127.0.0.1:6333",
    qdrantApiKey: optionalTrimmed(process.env.QDRANT_API_KEY),
    qdrantCollection: optionalTrimmed(process.env.QDRANT_COLLECTION) ?? "gongkao_course_chunks",
    embeddingBaseUrl:
      optionalTrimmed(process.env.EMBEDDING_BASE_URL) ??
      optionalTrimmed(process.env.OPENAI_BASE_URL) ??
      "https://api.openai.com/v1",
    embeddingApiKey: apiKey,
    embeddingModel,
    embeddingDimensions: integerFromEnv.parse(embeddingDimensions),
    embeddingBatchSize: integerFromEnv.parse(process.env.EMBEDDING_BATCH_SIZE ?? "32"),
    retrievalTopK: integerFromEnv.parse(process.env.KNOWLEDGE_RETRIEVAL_TOP_K ?? "8"),
    minimumScore: z.coerce.number().min(0).max(1).parse(process.env.KNOWLEDGE_MIN_SCORE ?? "0.35"),
  };
}
