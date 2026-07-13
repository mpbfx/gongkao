import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  type InferUIMessageChunk,
  type UIMessageStreamWriter,
} from "ai";

import type { TutorUIMessage } from "@/features/agent/tutor-ui-message";
import { streamQuestionWithTutor } from "@/server/agent/tutor/service";
import type { TutorInput } from "@/server/agent/tutor/context/question-context";
import type { TutorStreamEvent } from "@/server/agent/tutor/schemas/tutor-schemas";

type TutorChunk = InferUIMessageChunk<TutorUIMessage>;

export type TutorStreamState = {
  messageId: string;
  textId: string;
  textStarted: boolean;
  finished: boolean;
};

export function createTutorStreamState(): TutorStreamState {
  return {
    messageId: generateId(),
    textId: generateId(),
    textStarted: false,
    finished: false,
  };
}

export function tutorEventToUIMessageChunks(event: TutorStreamEvent, state: TutorStreamState): TutorChunk[] {
  if (state.finished) return [];

  if (event.type === "status") {
    return [{ type: "data-activity", data: { phase: event.phase, label: event.label }, transient: true }];
  }

  if (event.type === "review") {
    return [
      {
        type: "data-review",
        id: "review",
        data: {
          mistakeCause: event.mistakeCause,
          confidence: event.confidence,
          causeSummary: event.causeSummary,
          fastestPath: event.fastestPath,
          transferRule: event.transferRule,
        },
      },
    ];
  }

  if (event.type === "token") {
    const chunks: TutorChunk[] = [];
    if (!state.textStarted) {
      state.textStarted = true;
      chunks.push({ type: "text-start", id: state.textId });
    }
    chunks.push({ type: "text-delta", id: state.textId, delta: event.content });
    return chunks;
  }

  const chunks: TutorChunk[] = [];
  if (state.textStarted) chunks.push({ type: "text-end", id: state.textId });

  if (event.type === "done") {
    chunks.push({
      type: "data-suggestions",
      data: { items: event.suggestedPrompts },
      transient: true,
    });
    chunks.push({
      type: "message-metadata",
      messageMetadata: {
        createdAt: new Date().toISOString(),
        persistedMessageId: event.messageId,
        runtime: event.runtime,
        durationMs: event.durationMs,
      },
    });
    chunks.push({ type: "finish", finishReason: "stop" });
  } else {
    chunks.push({
      type: "error",
      errorText: event.type === "degraded" ? event.reason : event.message,
    });
    chunks.push({ type: "finish", finishReason: "error" });
  }

  state.finished = true;
  return chunks;
}

function writeChunks(writer: UIMessageStreamWriter<TutorUIMessage>, chunks: TutorChunk[]) {
  for (const chunk of chunks) writer.write(chunk);
}

export function createTutorUIMessageResponse(input: TutorInput, signal: AbortSignal) {
  const state = createTutorStreamState();
  const stream = createUIMessageStream<TutorUIMessage>({
    generateId: () => state.messageId,
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageId: state.messageId });
      await streamQuestionWithTutor(
        input,
        (event) => writeChunks(writer, tutorEventToUIMessageChunks(event, state)),
        signal
      );

      if (signal.aborted && !state.finished) {
        if (state.textStarted) writer.write({ type: "text-end", id: state.textId });
        writer.write({ type: "abort", reason: "讲解已取消。" });
        state.finished = true;
      }
    },
    onError: () => "讲题助教暂时不可用，请稍后重试。",
  });

  return createUIMessageStreamResponse({ stream });
}
