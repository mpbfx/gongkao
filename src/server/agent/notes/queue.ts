import { Queue } from "bullmq";
import IORedis from "ioredis";

export const AGENT_NOTE_QUEUE = "agent-note-enrichment";
export const AGENT_NOTE_DLQ = "agent-note-enrichment-dlq";

export type AgentNoteJobData = {
  noteId: string;
  userId: string;
  generationVersion: number;
};

export function agentNoteJobId(data: Pick<AgentNoteJobData, "noteId" | "generationVersion">) {
  return `${data.noteId}-${data.generationVersion}`;
}

// Adapted from Karakeep's enrichment queue conventions (AGPL-3.0),
// audited at bc50630767079b060488d1d790b96de1e06ea6ba. See NOTICE.
export const agentNoteQueueDefaults = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2_000 },
  removeOnComplete: { count: 1_000 },
  removeOnFail: { count: 5_000 },
};

type QueueGlobals = typeof globalThis & {
  agentNoteProducerConnection?: IORedis;
  agentNoteQueue?: Queue<AgentNoteJobData>;
  agentNoteDlq?: Queue<AgentNoteJobData & { error: string; failedAt: string }>;
};

function redisUrl() {
  const value = process.env.REDIS_URL?.trim();
  if (!value) throw new Error("REDIS_URL is required for agent note enrichment");
  return value;
}

function producerConnection() {
  const globals = globalThis as QueueGlobals;
  globals.agentNoteProducerConnection ??= new IORedis(redisUrl(), {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  return globals.agentNoteProducerConnection;
}

export function getAgentNoteQueue() {
  const globals = globalThis as QueueGlobals;
  globals.agentNoteQueue ??= new Queue<AgentNoteJobData>(AGENT_NOTE_QUEUE, {
    connection: producerConnection(),
    defaultJobOptions: agentNoteQueueDefaults,
  });
  return globals.agentNoteQueue;
}

export function getAgentNoteDlq() {
  const globals = globalThis as QueueGlobals;
  globals.agentNoteDlq ??= new Queue(AGENT_NOTE_DLQ, {
    connection: producerConnection(),
    defaultJobOptions: {
      removeOnComplete: { count: 1_000 },
      removeOnFail: { count: 5_000 },
    },
  });
  return globals.agentNoteDlq;
}

export async function enqueueAgentNote(data: AgentNoteJobData) {
  try {
    await getAgentNoteQueue().add("generate", data, {
      jobId: agentNoteJobId(data),
    });
    return true;
  } catch (error) {
    console.error("Failed to enqueue agent note", {
      noteId: data.noteId,
      generationVersion: data.generationVersion,
      error,
    });
    return false;
  }
}
