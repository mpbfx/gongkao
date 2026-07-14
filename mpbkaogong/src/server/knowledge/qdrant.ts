import { QdrantClient } from "@qdrant/js-client-rest";

import { loadKnowledgeConfig } from "@/server/knowledge/config";
import type { KnowledgeVectorPayload } from "@/server/knowledge/types";

let client: QdrantClient | null = null;

export function getQdrantClient() {
  const config = loadKnowledgeConfig();
  client ??= new QdrantClient({ url: config.qdrantUrl, apiKey: config.qdrantApiKey });
  return { client, config };
}

export async function ensureKnowledgeCollection() {
  const { client: qdrant, config } = getQdrantClient();
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((item) => item.name === config.qdrantCollection);

  if (!exists) {
    await qdrant.createCollection(config.qdrantCollection, {
      vectors: { size: config.embeddingDimensions, distance: "Cosine" },
    });
    return;
  }

  const collection = await qdrant.getCollection(config.qdrantCollection);
  const vectors = collection.config.params.vectors;
  const size = vectors && !Array.isArray(vectors) && "size" in vectors ? vectors.size : undefined;
  if (size !== config.embeddingDimensions) {
    throw new Error(`Qdrant 集合维度为 ${String(size)}，配置维度为 ${config.embeddingDimensions}。`);
  }
}

export async function upsertKnowledgeVectors(
  items: Array<{ id: string; vector: number[]; payload: KnowledgeVectorPayload }>
) {
  if (items.length === 0) return;
  const { client: qdrant, config } = getQdrantClient();
  await ensureKnowledgeCollection();
  await qdrant.upsert(config.qdrantCollection, {
    wait: true,
    points: items.map((item) => ({ id: item.id, vector: item.vector, payload: item.payload })),
  });
}

export async function deleteKnowledgeVectors(ids: string[]) {
  if (ids.length === 0) return;
  const { client: qdrant, config } = getQdrantClient();
  const collections = await qdrant.getCollections();
  if (!collections.collections.some((item) => item.name === config.qdrantCollection)) return;
  await qdrant.delete(config.qdrantCollection, { wait: true, points: ids });
}

export async function searchKnowledgeVectors(vector: number[], limit?: number) {
  const { client: qdrant, config } = getQdrantClient();
  await ensureKnowledgeCollection();
  return qdrant.search(config.qdrantCollection, {
    vector,
    limit: limit ?? config.retrievalTopK,
    score_threshold: config.minimumScore,
    with_payload: true,
    with_vector: false,
  });
}
