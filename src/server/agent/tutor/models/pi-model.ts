import type { Model } from "@mariozechner/pi-ai";

export class TutorModelUnavailableError extends Error {
  constructor(message = "AI 模型暂时不可用，请稍后重试。") {
    super(message);
    this.name = "TutorModelUnavailableError";
  }
}

function tutorApiMode() {
  const configured = process.env.OPENAI_API_MODE?.toLowerCase();
  if (configured === "chat" || configured === "responses") return configured;
  return process.env.OPENAI_BASE_URL && !process.env.OPENAI_BASE_URL.includes("api.openai.com")
    ? "chat"
    : "responses";
}

export function createTutorModel(): Model<"openai-completions"> | Model<"openai-responses"> {
  const modelId = process.env.OPENAI_MODEL;

  if (!process.env.OPENAI_API_KEY || !modelId) {
    throw new TutorModelUnavailableError("AI 模型尚未配置，当前无法生成讲解。");
  }

  const mode = tutorApiMode();
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const common = {
    id: modelId,
    name: modelId,
    provider: "openai-compatible",
    baseUrl,
    reasoning: false,
    input: ["text"] as Array<"text" | "image">,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 4_096,
  };

  if (mode === "responses") {
    return { ...common, api: "openai-responses" };
  }

  return {
    ...common,
    api: "openai-completions",
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      supportsUsageInStreaming: false,
      supportsStrictMode: false,
      maxTokensField: "max_tokens",
    },
  };
}

export function getTutorApiKey() {
  return process.env.OPENAI_API_KEY;
}
