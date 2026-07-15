import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  type InferUIMessageChunk,
  type UIMessageStreamWriter,
} from "ai";

import type { KnowledgeUIMessage } from "@/features/agent/knowledge-ui-message";
import type { AuthenticatedUser } from "@/lib/auth/guards";
import type { KnowledgeStreamEvent } from "@/server/agent/knowledge/schemas";
import { streamKnowledgeMessage } from "@/server/agent/knowledge/service";

type KnowledgeChunk = InferUIMessageChunk<KnowledgeUIMessage>;

function write(writer: UIMessageStreamWriter<KnowledgeUIMessage>, chunks: KnowledgeChunk[]) {
  for (const chunk of chunks) writer.write(chunk);
}

export function createKnowledgeUIMessageResponse(
  input: { user: AuthenticatedUser; sessionId: string; prompt: string },
  signal: AbortSignal
) {
  const messageId = generateId();
  const textId = generateId();
  let textStarted = false;
  let finished = false;
  const stream = createUIMessageStream<KnowledgeUIMessage>({
    generateId: () => messageId,
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageId });
      await streamKnowledgeMessage({
        ...input,
        signal,
        emit(event: KnowledgeStreamEvent) {
          if (finished) return;
          if (event.type === "status") {
            write(writer, [{ type: "data-activity", data: { label: event.label }, transient: true }]);
          } else if (event.type === "citations") {
            write(writer, [{ type: "data-citations", id: "citations", data: { items: event.citations } }]);
          } else if (event.type === "token") {
            if (!textStarted) {
              writer.write({ type: "text-start", id: textId });
              textStarted = true;
            }
            writer.write({ type: "text-delta", id: textId, delta: event.content });
          } else {
            if (textStarted) writer.write({ type: "text-end", id: textId });
            if (event.type === "done") {
              writer.write({
                type: "message-metadata",
                messageMetadata: {
                  createdAt: new Date().toISOString(),
                  persistedMessageId: event.messageId,
                  durationMs: event.durationMs,
                },
              });
              writer.write({ type: "finish", finishReason: "stop" });
            } else {
              writer.write({ type: "error", errorText: event.message });
              writer.write({ type: "finish", finishReason: "error" });
            }
            finished = true;
          }
        },
      });
      if (signal.aborted && !finished) {
        if (textStarted) writer.write({ type: "text-end", id: textId });
        writer.write({ type: "abort", reason: "知识问答已取消。" });
      }
    },
    onError: () => "知识问答暂时不可用，请稍后重试。",
  });
  return createUIMessageStreamResponse({ stream });
}
