import { Worker } from "bullmq";
import IORedis from "ioredis";

import {
  agentNoteFailureMessage,
  enrichAgentNote,
  findAgentNotesNeedingReconciliation,
  markAgentNoteFailed,
} from "@/server/agent/notes/enrichment";
import {
  AGENT_NOTE_QUEUE,
  enqueueAgentNote,
  getAgentNoteDlq,
  getAgentNoteQueue,
  type AgentNoteJobData,
} from "@/server/agent/notes/queue";

const redisUrl = process.env.REDIS_URL?.trim();
if (!redisUrl) throw new Error("REDIS_URL is required to start the agent note worker");

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const worker = new Worker<AgentNoteJobData>(
  AGENT_NOTE_QUEUE,
  async (job) => enrichAgentNote(job.data),
  {
    connection,
    concurrency: 2,
    limiter: { max: 10, duration: 60_000 },
  }
);

worker.on("failed", async (job, error) => {
  console.error("Agent note job failed", {
    jobId: job?.id,
    noteId: job?.data.noteId,
    attemptsMade: job?.attemptsMade,
    error,
  });
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  await markAgentNoteFailed(job.data, error);
  await getAgentNoteDlq().add("failed", {
    ...job.data,
    error: agentNoteFailureMessage(error),
    failedAt: new Date().toISOString(),
  });
});

worker.on("stalled", (jobId) => {
  console.warn("Agent note job stalled", { jobId });
});

worker.on("error", (error) => {
  console.error("Agent note worker error", error);
});

async function reconcile() {
  const notes = await findAgentNotesNeedingReconciliation();
  await Promise.all(
    notes.map((note) =>
      enqueueAgentNote({
        noteId: note.id,
        userId: note.userId,
        generationVersion: note.generationVersion,
      })
    )
  );
}

void reconcile().catch((error) => console.error("Agent note reconciliation failed", error));
const reconciliationTimer = setInterval(() => {
  void reconcile().catch((error) => console.error("Agent note reconciliation failed", error));
}, 60_000);
reconciliationTimer.unref();

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info("Shutting down agent note worker", { signal });
  clearInterval(reconciliationTimer);
  await worker.pause();
  await worker.close();
  await getAgentNoteQueue().close();
  await getAgentNoteDlq().close();
  await connection.quit();
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    void shutdown(signal)
      .catch((error) => {
        console.error("Agent note worker shutdown failed", error);
        process.exitCode = 1;
      })
      .finally(() => process.exit());
  });
}

console.info("Agent note worker started", { queue: AGENT_NOTE_QUEUE, concurrency: 2 });
