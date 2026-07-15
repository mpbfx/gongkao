import { parseArgs } from "node:util";

import { config } from "dotenv";

config({ path: ".env.local" });
config();

const { importSubtitleDirectory, reindexKnowledgeSource, resumeKnowledgeImport } = await import(
  "../../src/server/knowledge/ingestion-service"
);
const { prisma } = await import("../../src/lib/db/prisma");

const command = process.argv[2];
const { values } = parseArgs({
  args: process.argv.slice(3),
  options: {
    path: { type: "string" },
    bvid: { type: "string" },
    title: { type: "string" },
    jobId: { type: "string" },
    sourceId: { type: "string" },
  },
});

async function main() {
  if (command === "import") {
    if (!values.path || !values.bvid) throw new Error("import 需要 --path 和 --bvid。");
    return importSubtitleDirectory({ directory: values.path, bvid: values.bvid, titlePrefix: values.title });
  }
  if (command === "resume") {
    if (!values.jobId) throw new Error("resume 需要 --jobId。");
    return resumeKnowledgeImport(values.jobId);
  }
  if (command === "reindex") {
    if (!values.sourceId) throw new Error("reindex 需要 --sourceId。");
    return reindexKnowledgeSource(values.sourceId);
  }
  throw new Error("命令应为 import、resume 或 reindex。");
}

try {
  const result = await main();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
