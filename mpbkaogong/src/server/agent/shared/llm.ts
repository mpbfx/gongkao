import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
    return null;
  }

  openaiClient ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });

  return openaiClient;
}

export function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
}

function getOpenAIApiMode() {
  const configuredMode = process.env.OPENAI_API_MODE?.toLowerCase();

  if (configuredMode === "chat" || configuredMode === "responses") {
    return configuredMode;
  }

  const baseUrl = process.env.OPENAI_BASE_URL?.toLowerCase();

  if (baseUrl && !baseUrl.includes("api.openai.com")) {
    return "chat";
  }

  return "responses";
}

function parseStructuredOutput<T extends z.ZodType>(schema: T, rawText: string | null | undefined) {
  if (!rawText) {
    return null;
  }

  try {
    const json = JSON.parse(rawText);
    const parsed = schema.safeParse(json);

    if (parsed.success) {
      return parsed.data;
    }

    if (json && typeof json === "object" && !Array.isArray(json)) {
      for (const value of Object.values(json)) {
        const nested = schema.safeParse(value);

        if (nested.success) {
          return nested.data;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function generateWithResponsesApi<T extends z.ZodType>({
  client,
  model,
  schema,
  name,
  instructions,
  input,
}: {
  client: OpenAI;
  model: string;
  schema: T;
  name: string;
  instructions: string;
  input: string;
}) {
  const response = await client.responses.create({
    model,
    instructions,
    input,
    text: {
      format: zodTextFormat(schema, name),
    },
  });

  return parseStructuredOutput(schema, response.output_text);
}

async function generateWithChatCompletions<T extends z.ZodType>({
  client,
  model,
  schema,
  name,
  instructions,
  input,
}: {
  client: OpenAI;
  model: string;
  schema: T;
  name: string;
  instructions: string;
  input: string;
}) {
  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          instructions,
          `你必须只输出一个 JSON 对象，结构名为 ${name}。`,
          `JSON Schema: ${JSON.stringify(z.toJSONSchema(schema))}`,
          "不要输出 Markdown、代码块或 JSON 之外的解释文字。",
        ].join("\n"),
      },
      {
        role: "user",
        content: input,
      },
    ],
  });

  return parseStructuredOutput(schema, response.choices[0]?.message.content);
}

export async function generateStructuredResponse<T extends z.ZodType>({
  schema,
  name,
  instructions,
  input,
  fallback,
}: {
  schema: T;
  name: string;
  instructions: string;
  input: string;
  fallback: z.infer<T>;
}): Promise<z.infer<T>> {
  const result = await generateStructuredResponseWithStatus({
    schema,
    name,
    instructions,
    input,
    fallback,
  });

  return result.data;
}

export async function generateStructuredResponseWithStatus<T extends z.ZodType>({
  schema,
  name,
  instructions,
  input,
  fallback,
}: {
  schema: T;
  name: string;
  instructions: string;
  input: string;
  fallback: z.infer<T>;
}): Promise<{ data: z.infer<T>; usedFallback: boolean }> {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL;

  if (!client || !model) {
    return { data: fallback, usedFallback: true };
  }

  const generators =
    getOpenAIApiMode() === "chat"
      ? [generateWithChatCompletions, generateWithResponsesApi]
      : [generateWithResponsesApi, generateWithChatCompletions];

  for (const generator of generators) {
    try {
      const output = await generator({
        client,
        model,
        schema,
        name,
        instructions,
        input,
      });

      if (output) {
        return { data: output, usedFallback: false };
      }
    } catch (error) {
      console.warn(`Agent LLM generation failed with ${generator.name}`, error);
    }
  }

  console.error("Agent LLM generation returned invalid structured output");

  return { data: fallback, usedFallback: true };
}

async function* streamWithResponsesApi({
  client,
  model,
  instructions,
  input,
}: {
  client: OpenAI;
  model: string;
  instructions: string;
  input: string;
}) {
  const stream = await client.responses.create({
    model,
    instructions,
    input,
    stream: true,
  });

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      yield event.delta;
    }
  }
}

async function* streamWithChatCompletions({
  client,
  model,
  instructions,
  input,
}: {
  client: OpenAI;
  model: string;
  instructions: string;
  input: string;
}) {
  const stream = await client.chat.completions.create({
    model,
    stream: true,
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: input },
    ],
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta.content;

    if (content) {
      yield content;
    }
  }
}

export async function* streamTextResponse({
  instructions,
  input,
  fallback,
}: {
  instructions: string;
  input: string;
  fallback: string;
}) {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL;

  if (!client || !model) {
    yield fallback;
    return;
  }

  const generators =
    getOpenAIApiMode() === "chat"
      ? [streamWithChatCompletions, streamWithResponsesApi]
      : [streamWithResponsesApi, streamWithChatCompletions];

  for (const generator of generators) {
    let yielded = false;

    try {
      for await (const chunk of generator({ client, model, instructions, input })) {
        yielded = true;
        yield chunk;
      }

      return;
    } catch (error) {
      console.warn(`Agent LLM streaming failed with ${generator.name}`, error);

      if (yielded) {
        throw error;
      }
    }
  }

  yield fallback;
}
