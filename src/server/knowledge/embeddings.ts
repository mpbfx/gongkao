import OpenAI from "openai";
import pLimit from "p-limit";

import { loadKnowledgeConfig } from "@/server/knowledge/config";

let client: OpenAI | null = null;

function embeddingClient() {
  const config = loadKnowledgeConfig();
  client ??= new OpenAI({ apiKey: config.embeddingApiKey, baseURL: config.embeddingBaseUrl });
  return { client, config };
}

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) return [];
  const { client: openai, config } = embeddingClient();
  const batches: Array<{ offset: number; values: string[] }> = [];

  for (let offset = 0; offset < texts.length; offset += config.embeddingBatchSize) {
    batches.push({ offset, values: texts.slice(offset, offset + config.embeddingBatchSize) });
  }

  const limit = pLimit(2);
  const results = await Promise.all(
    batches.map((batch) =>
      limit(async () => {
        const response = await openai.embeddings.create({
          model: config.embeddingModel,
          input: batch.values,
          encoding_format: "float",
        });
        const vectors = [...response.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);

        if (vectors.length !== batch.values.length) {
          throw new Error(`Embedding 返回数量不匹配：期望 ${batch.values.length}，实际 ${vectors.length}。`);
        }
        for (const vector of vectors) {
          if (vector.length !== config.embeddingDimensions) {
            throw new Error(
              `Embedding 维度不匹配：配置 ${config.embeddingDimensions}，接口返回 ${vector.length}。`
            );
          }
        }

        return { offset: batch.offset, vectors };
      })
    )
  );

  return results
    .sort((a, b) => a.offset - b.offset)
    .flatMap((batch) => batch.vectors);
}

export async function embedQuery(text: string) {
  const [vector] = await embedTexts([text]);
  if (!vector) throw new Error("Embedding 接口没有返回查询向量。");
  return vector;
}
