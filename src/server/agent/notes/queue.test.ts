import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  queues: [] as Array<{ name: string; options: Record<string, unknown> }>,
}));

vi.mock("bullmq", () => ({
  Queue: class {
    add = mocks.add;

    constructor(name: string, options: Record<string, unknown>) {
      mocks.queues.push({ name, options });
    }
  },
}));

vi.mock("ioredis", () => ({
  default: class {
    constructor() {}
  },
}));

import {
  AGENT_NOTE_QUEUE,
  agentNoteJobId,
  agentNoteQueueDefaults,
  enqueueAgentNote,
  getAgentNoteQueue,
} from "@/server/agent/notes/queue";

function clearQueueGlobals() {
  const globals = globalThis as typeof globalThis & {
    agentNoteProducerConnection?: unknown;
    agentNoteQueue?: unknown;
    agentNoteDlq?: unknown;
  };
  delete globals.agentNoteProducerConnection;
  delete globals.agentNoteQueue;
  delete globals.agentNoteDlq;
}

describe("agent note queue", () => {
  beforeEach(() => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    clearQueueGlobals();
    mocks.add.mockReset();
    mocks.queues.length = 0;
  });

  it("uses bounded retention and three exponential attempts", () => {
    getAgentNoteQueue();

    expect(mocks.queues).toHaveLength(1);
    expect(mocks.queues[0]).toMatchObject({
      name: AGENT_NOTE_QUEUE,
      options: { defaultJobOptions: agentNoteQueueDefaults },
    });
    expect(agentNoteQueueDefaults).toMatchObject({
      attempts: 3,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: { count: 1_000 },
      removeOnFail: { count: 5_000 },
    });
  });

  it("deduplicates repeat delivery with a generation-specific job id", async () => {
    mocks.add.mockResolvedValue({ id: "note-1-2" });

    await expect(
      enqueueAgentNote({ noteId: "note-1", userId: "user-1", generationVersion: 2 })
    ).resolves.toBe(true);
    expect(mocks.add).toHaveBeenCalledWith(
      "generate",
      { noteId: "note-1", userId: "user-1", generationVersion: 2 },
      { jobId: agentNoteJobId({ noteId: "note-1", generationVersion: 2 }) }
    );
  });

  it("leaves the note pending when Redis is temporarily unavailable", async () => {
    mocks.add.mockRejectedValue(new Error("ECONNREFUSED"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      enqueueAgentNote({ noteId: "note-1", userId: "user-1", generationVersion: 1 })
    ).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to enqueue agent note",
      expect.objectContaining({ noteId: "note-1", generationVersion: 1 })
    );
    errorSpy.mockRestore();
  });
});
