import { Prisma } from "@/generated/prisma/client";

/**
 * 提交练习时的批量写 SQL 构造。
 *
 * 提交是全站唯一的成绩落库路径，逐行写会在一次事务里堆出数百条串行 SQL：
 * 135 题实测 690 条，数据库延迟稍高即突破事务超时导致整体回滚。这里把
 * 逐行写折叠成按表一条语句。
 *
 * 走原生 SQL 的三点注意：
 * - `updatedAt` 是 Prisma 客户端侧维护的，必须显式赋值；
 * - 只更新已存在的行，新行仍走 Prisma 的 createMany，避免自行生成主键；
 * - 语句参数量受数据库上限约束，按 CHUNK_SIZE 分片。
 */

/** 单条语句最多处理的行数，避免占位符数量超出数据库上限。 */
const CHUNK_SIZE = 200;

/** 判断是否为可重试的并发写冲突（死锁 / 锁等待超时）。 */
export function isWriteConflictError(error: unknown) {
  const code = (error as { code?: string }).code;

  if (code === "P2034") {
    return true;
  }

  const text = `${(error as { message?: string }).message ?? ""}${JSON.stringify(
    (error as { meta?: unknown }).meta ?? ""
  )}`;

  return /Deadlock|TransactionWriteConflict|Lock wait timeout/i.test(text);
}

/**
 * 并发写冲突时按短退避重试。
 *
 * 多个提交同时累加同一个标签统计或同一道错题时，数据库可能判定死锁并回滚
 * 其中一方。这是并发写的正常结果，重试即可；事务已整体回滚，重跑是安全的。
 */
export async function runWithWriteConflictRetry<T>(
  run: () => Promise<T>,
  { attempts = 3, baseDelayMs = 25 }: { attempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= attempts || !isWriteConflictError(error)) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
    }
  }
}

export function chunk<T>(items: T[], size = CHUNK_SIZE) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

/** 构造 `CASE <key> WHEN k THEN v ... ELSE <column> END` 片段。 */
function caseByQuestionId<T>(
  column: string,
  rows: Array<{ questionId: string; value: T }>
): Prisma.Sql {
  const branches = rows.map(
    (row) => Prisma.sql`WHEN ${row.questionId} THEN ${row.value}`
  );

  return Prisma.sql`CASE \`questionId\` ${Prisma.join(branches, " ")} ELSE ${Prisma.raw(`\`${column}\``)} END`;
}

export type PracticeAnswerWrite = {
  questionId: string;
  answer: string | null;
  isCorrect: boolean | null;
  timeSpentSeconds: number;
  decisionNote: string | null;
  answeredAt: Date | null;
};

/**
 * 一条语句更新本次会话的全部作答行。
 *
 * 作答行在建会话时已经全部创建，提交时只会是 UPDATE，不需要 upsert。
 */
export function buildPracticeAnswerUpdate(
  sessionId: string,
  rows: PracticeAnswerWrite[],
  now: Date
): Prisma.Sql {
  const questionIds = rows.map((row) => row.questionId);

  return Prisma.sql`
    UPDATE \`PracticeAnswer\`
    SET \`answer\` = ${caseByQuestionId(
      "answer",
      rows.map((row) => ({ questionId: row.questionId, value: row.answer }))
    )},
      \`isCorrect\` = ${caseByQuestionId(
        "isCorrect",
        rows.map((row) => ({ questionId: row.questionId, value: row.isCorrect }))
      )},
      \`timeSpentSeconds\` = ${caseByQuestionId(
        "timeSpentSeconds",
        rows.map((row) => ({ questionId: row.questionId, value: row.timeSpentSeconds }))
      )},
      \`decisionNote\` = ${caseByQuestionId(
        "decisionNote",
        rows.map((row) => ({ questionId: row.questionId, value: row.decisionNote }))
      )},
      \`answeredAt\` = ${caseByQuestionId(
        "answeredAt",
        rows.map((row) => ({ questionId: row.questionId, value: row.answeredAt }))
      )},
      \`updatedAt\` = ${now}
    WHERE \`sessionId\` = ${sessionId}
      AND \`questionId\` IN (${Prisma.join(questionIds)})
  `;
}

export type WrongQuestionUpdate = {
  questionId: string;
  tagId: string | null;
  lastPracticeAnswerId: string;
};

/**
 * 一条语句更新已存在的错题行：错误次数 +1、重置 resolvedAt。
 *
 * 用 `wrongCount` + 1 而不是先读后写，避免并发提交丢失更新。
 */
export function buildWrongQuestionUpdate(
  userId: string,
  rows: WrongQuestionUpdate[],
  now: Date
): Prisma.Sql {
  const questionIds = rows.map((row) => row.questionId);

  return Prisma.sql`
    UPDATE \`WrongQuestion\`
    SET \`wrongCount\` = \`wrongCount\` + 1,
      \`lastWrongAt\` = ${now},
      \`resolvedAt\` = NULL,
      \`tagId\` = ${caseByQuestionId(
        "tagId",
        rows.map((row) => ({ questionId: row.questionId, value: row.tagId }))
      )},
      \`lastPracticeAnswerId\` = ${caseByQuestionId(
        "lastPracticeAnswerId",
        rows.map((row) => ({
          questionId: row.questionId,
          value: row.lastPracticeAnswerId,
        }))
      )},
      \`updatedAt\` = ${now}
    WHERE \`userId\` = ${userId}
      AND \`questionId\` IN (${Prisma.join(questionIds)})
  `;
}

/**
 * 一条语句把本次答对的题目从错题本移出。
 *
 * 关联本次会话的作答行取 `lastPracticeAnswerId`，保留「哪一次作答让它被掌握」
 * 的信息；`resolvedAt IS NULL` 保证幂等，已掌握的错题不会被重复标记。
 */
export function buildWrongQuestionResolve(
  userId: string,
  sessionId: string,
  questionIds: string[],
  now: Date
): Prisma.Sql {
  return Prisma.sql`
    UPDATE \`WrongQuestion\` AS \`w\`
    JOIN \`PracticeAnswer\` AS \`a\`
      ON \`a\`.\`questionId\` = \`w\`.\`questionId\`
      AND \`a\`.\`sessionId\` = ${sessionId}
    SET \`w\`.\`resolvedAt\` = ${now},
      \`w\`.\`lastPracticeAnswerId\` = \`a\`.\`id\`,
      \`w\`.\`updatedAt\` = ${now}
    WHERE \`w\`.\`userId\` = ${userId}
      AND \`w\`.\`resolvedAt\` IS NULL
      AND \`w\`.\`questionId\` IN (${Prisma.join(questionIds)})
  `;
}

export type TagStatsUpdate = {
  tagId: string;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  /** 仅筑基练习有值：本轮是否达标，以及本轮答对数 */
  foundation: { passed: boolean; roundCorrect: number } | null;
};

function caseByTagId<T>(column: string, rows: Array<{ tagId: string; value: T }>): Prisma.Sql {
  const branches = rows.map((row) => Prisma.sql`WHEN ${row.tagId} THEN ${row.value}`);

  return Prisma.sql`CASE \`tagId\` ${Prisma.join(branches, " ")} ELSE ${Prisma.raw(`\`${column}\``)} END`;
}

/**
 * 一条语句累加已存在的标签统计。
 *
 * 计数一律用 `列 + 增量` 的原子写法：原先的「先 findUnique 再写回绝对值」
 * 在并发提交时会丢失更新。正确率由累加后的新值即时算出。
 */
export function buildTagStatsUpdate(
  userId: string,
  rows: TagStatsUpdate[],
  now: Date
): Prisma.Sql {
  const tagIds = rows.map((row) => row.tagId);

  // MySQL/MariaDB 的 UPDATE ... SET 按书写顺序求值，靠后的表达式读到的是
  // 前面已经赋过的新值。因此 accuracy 必须放在计数之后，并直接用列的新值，
  // 不能再叠加一次增量。
  return Prisma.sql`
    UPDATE \`UserTagStats\`
    SET \`answeredCount\` = \`answeredCount\` + ${caseByTagId(
      "answeredCount",
      rows.map((row) => ({ tagId: row.tagId, value: row.answeredCount }))
    )},
      \`correctCount\` = \`correctCount\` + ${caseByTagId(
        "correctCount",
        rows.map((row) => ({ tagId: row.tagId, value: row.correctCount }))
      )},
      \`wrongCount\` = \`wrongCount\` + ${caseByTagId(
        "wrongCount",
        rows.map((row) => ({ tagId: row.tagId, value: row.wrongCount }))
      )},
      \`accuracy\` = CASE
        WHEN \`answeredCount\` > 0
        THEN ROUND(\`correctCount\` * 100 / \`answeredCount\`, 2)
        ELSE NULL
      END,
      \`lastPracticedAt\` = ${now},
      ${buildFoundationAssignments(rows, now)}
      \`updatedAt\` = ${now}
    WHERE \`userId\` = ${userId}
      AND \`tagId\` IN (${Prisma.join(tagIds)})
  `;
}

/**
 * 筑基相关列只在筑基练习里更新，普通练习完全不碰。
 *
 * `foundationStatus` 用 `已通过则保持通过` 的写法：叶子通过后再失败一轮
 * 不应该被降级回 TRAINING，否则训练主线会倒退。
 */
function buildFoundationAssignments(rows: TagStatsUpdate[], now: Date): Prisma.Sql {
  const foundationRows = rows.filter(
    (row): row is TagStatsUpdate & { foundation: { passed: boolean; roundCorrect: number } } =>
      row.foundation !== null
  );

  if (foundationRows.length === 0) {
    return Prisma.empty;
  }

  const roundCorrect = caseByTagId(
    "lastRoundCorrect",
    foundationRows.map((row) => ({ tagId: row.tagId, value: row.foundation.roundCorrect }))
  );

  return Prisma.sql`
      \`foundationStatus\` = CASE
        WHEN \`foundationStatus\` = 'PASSED' THEN 'PASSED'
        ELSE ${caseByTagId(
          "foundationStatus",
          foundationRows.map((row) => ({
            tagId: row.tagId,
            value: row.foundation.passed ? "PASSED" : "TRAINING",
          }))
        )}
      END,
      \`foundationRoundCount\` = \`foundationRoundCount\` + 1,
      \`lastRoundCorrect\` = ${roundCorrect},
      \`bestRoundCorrect\` = GREATEST(COALESCE(\`bestRoundCorrect\`, 0), ${roundCorrect}),
      \`passedAt\` = COALESCE(\`passedAt\`, ${caseByTagId(
        "passedAt",
        foundationRows.map((row) => ({
          tagId: row.tagId,
          value: row.foundation.passed ? now : null,
        }))
      )}),`;
}
