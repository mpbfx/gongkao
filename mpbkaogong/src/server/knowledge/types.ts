export type KnowledgeVectorPayload = {
  chunkId: string;
  sourceId: string;
  bvid: string;
  partNo: number;
  title: string;
  startMs: number;
  endMs: number;
  contentHash: string;
};

export type KnowledgeCitation = {
  chunkId: string;
  sourceId: string;
  title: string;
  quote: string;
  score: number;
  bvid: string;
  partNo: number;
  startMs: number;
  endMs: number;
  url: string;
};

export type KnowledgeSearchInput = {
  query: string;
  limit?: number;
  questionTagName?: string | null;
  questionText?: string | null;
};

export type KnowledgeSearchResult = KnowledgeCitation;
