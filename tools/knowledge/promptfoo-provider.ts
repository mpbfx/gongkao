import { config } from "dotenv";

config({ path: ".env.local" });
config();

export default class KnowledgeRetrieverProvider {
  id() {
    return "gongkao-knowledge-retriever";
  }

  async callApi(prompt: string) {
    const { searchCourseKnowledge } = await import("../../src/server/knowledge/retriever");
    const results = await searchCourseKnowledge({ query: prompt, limit: 5 });
    return { output: JSON.stringify({ query: prompt, results }) };
  }
}
