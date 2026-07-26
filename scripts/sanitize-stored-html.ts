/**
 * 存量题库富文本清洗脚本。
 *
 * 早期入库的题干、材料、选项与解析没有经过白名单消毒，本脚本按批次重新消毒
 * 并同步刷新检索用的 plainText。仅在内容发生变化时写库，可重复执行。
 *
 * 用法：
 *   npx tsx scripts/sanitize-stored-html.ts            # 试运行，只统计不写库
 *   npx tsx scripts/sanitize-stored-html.ts --apply    # 实际写库
 */
import { prisma } from "../src/lib/db/prisma";
import { richHtmlToPlainText, sanitizeRichHtml } from "../src/server/content/rich-html";

const BATCH_SIZE = 200;
const apply = process.argv.includes("--apply");

type Stats = { scanned: number; changed: number };

function report(label: string, stats: Stats) {
  console.log(`[${label}] 扫描 ${stats.scanned} 条，需要清洗 ${stats.changed} 条`);
}

async function sanitizeQuestions() {
  const stats: Stats = { scanned: 0, changed: 0 };
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.question.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, titleHtml: true, analysisHtml: true },
    });

    if (rows.length === 0) {
      break;
    }

    cursor = rows[rows.length - 1].id;
    stats.scanned += rows.length;

    for (const row of rows) {
      const titleHtml = sanitizeRichHtml(row.titleHtml);
      const analysisHtml = sanitizeRichHtml(row.analysisHtml);

      if (titleHtml === row.titleHtml && analysisHtml === row.analysisHtml) {
        continue;
      }

      stats.changed += 1;

      if (apply) {
        await prisma.question.update({
          where: { id: row.id },
          data: { titleHtml, analysisHtml, plainText: richHtmlToPlainText(titleHtml) },
        });
      }
    }
  }

  report("question", stats);
  return stats;
}

async function sanitizeOptions() {
  const stats: Stats = { scanned: 0, changed: 0 };
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.questionOption.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, contentHtml: true },
    });

    if (rows.length === 0) {
      break;
    }

    cursor = rows[rows.length - 1].id;
    stats.scanned += rows.length;

    for (const row of rows) {
      const contentHtml = sanitizeRichHtml(row.contentHtml);

      if (contentHtml === row.contentHtml) {
        continue;
      }

      stats.changed += 1;

      if (apply) {
        await prisma.questionOption.update({
          where: { id: row.id },
          data: { contentHtml, plainText: richHtmlToPlainText(contentHtml) },
        });
      }
    }
  }

  report("questionOption", stats);
  return stats;
}

async function sanitizeMaterials() {
  const stats: Stats = { scanned: 0, changed: 0 };
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.material.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, contentHtml: true },
    });

    if (rows.length === 0) {
      break;
    }

    cursor = rows[rows.length - 1].id;
    stats.scanned += rows.length;

    for (const row of rows) {
      const contentHtml = sanitizeRichHtml(row.contentHtml);

      if (contentHtml === row.contentHtml) {
        continue;
      }

      stats.changed += 1;

      if (apply) {
        await prisma.material.update({
          where: { id: row.id },
          data: { contentHtml, plainText: richHtmlToPlainText(contentHtml) },
        });
      }
    }
  }

  report("material", stats);
  return stats;
}

async function main() {
  console.log(apply ? "模式：写库" : "模式：试运行（加 --apply 才会写库）");

  const results = [await sanitizeQuestions(), await sanitizeOptions(), await sanitizeMaterials()];
  const changed = results.reduce((total, stats) => total + stats.changed, 0);

  console.log(apply ? `完成，已清洗 ${changed} 条` : `完成，待清洗 ${changed} 条`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
