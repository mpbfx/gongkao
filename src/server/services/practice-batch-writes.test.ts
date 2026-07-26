import { describe, expect, it, vi } from "vitest";

import {
  buildPracticeAnswerUpdate,
  buildTagStatsUpdate,
  chunk,
  isWriteConflictError,
  runWithWriteConflictRetry,
} from "@/server/services/practice-batch-writes";

describe("chunk", () => {
  it("按大小切片且不丢元素", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("空数组返回空切片", () => {
    expect(chunk([], 2)).toEqual([]);
  });
});

describe("isWriteConflictError", () => {
  it("识别 Prisma 事务冲突错误码", () => {
    expect(isWriteConflictError({ code: "P2034" })).toBe(true);
  });

  it("识别数据库死锁信息", () => {
    expect(isWriteConflictError(new Error("Deadlock found when trying to get lock"))).toBe(true);
  });

  it("识别适配器抛出的写冲突", () => {
    expect(isWriteConflictError({ code: "P2010", meta: { driverAdapterError: "TransactionWriteConflict" } })).toBe(
      true
    );
  });

  it("不把普通错误当成冲突", () => {
    expect(isWriteConflictError(new Error("练习不存在"))).toBe(false);
  });
});

describe("runWithWriteConflictRetry", () => {
  it("写冲突后重试并最终成功", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("Deadlock found when trying to get lock"))
      .mockResolvedValueOnce("ok");

    await expect(runWithWriteConflictRetry(run, { baseDelayMs: 0 })).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("非冲突错误立即抛出，不重试", async () => {
    const run = vi.fn().mockRejectedValue(new Error("练习不存在"));

    await expect(runWithWriteConflictRetry(run, { baseDelayMs: 0 })).rejects.toThrow("练习不存在");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("超过重试次数后抛出最后一次错误", async () => {
    const run = vi.fn().mockRejectedValue(new Error("Deadlock found"));

    await expect(
      runWithWriteConflictRetry(run, { attempts: 3, baseDelayMs: 0 })
    ).rejects.toThrow("Deadlock found");
    expect(run).toHaveBeenCalledTimes(3);
  });
});

describe("SQL 构造", () => {
  it("作答更新把每行折叠进一条语句", () => {
    const statement = buildPracticeAnswerUpdate(
      "session-1",
      [
        {
          questionId: "q1",
          answer: "A",
          isCorrect: true,
          timeSpentSeconds: 10,
          decisionNote: null,
          answeredAt: new Date("2026-01-01T00:00:00Z"),
        },
        {
          questionId: "q2",
          answer: null,
          isCorrect: null,
          timeSpentSeconds: 3,
          decisionNote: "排除 A",
          answeredAt: null,
        },
      ],
      new Date("2026-01-01T00:00:00Z")
    );

    expect(statement.sql).toContain("UPDATE `PracticeAnswer`");
    expect(statement.sql).toContain("`updatedAt`");
    // 每列一个 CASE，题目 id 与取值全部走参数占位符
    expect(statement.sql.match(/CASE `questionId`/g)).toHaveLength(5);
    expect(statement.values).toContain("q1");
    expect(statement.values).toContain("排除 A");
    expect(statement.sql).not.toContain("排除 A");
  });

  it("标签统计只做增量累加，正确率排在计数之后", () => {
    const statement = buildTagStatsUpdate(
      "user-1",
      [{ tagId: "tag-1", answeredCount: 3, correctCount: 2, wrongCount: 1, foundation: null }],
      new Date("2026-01-01T00:00:00Z")
    );

    expect(statement.sql).toContain("`answeredCount` = `answeredCount` +");
    expect(statement.sql).toContain("`correctCount` = `correctCount` +");
    // MySQL 的 SET 按顺序求值，accuracy 必须晚于计数并直接用新值
    expect(statement.sql.indexOf("`accuracy`")).toBeGreaterThan(
      statement.sql.indexOf("`correctCount` = `correctCount` +")
    );
    expect(statement.sql).toContain("ROUND(`correctCount` * 100 / `answeredCount`, 2)");
    // 非筑基练习不碰筑基列
    expect(statement.sql).not.toContain("foundationStatus");
  });

  it("筑基练习保留已通过状态并累加轮次", () => {
    const statement = buildTagStatsUpdate(
      "user-1",
      [
        {
          tagId: "tag-1",
          answeredCount: 15,
          correctCount: 3,
          wrongCount: 12,
          foundation: { passed: false, roundCorrect: 3 },
        },
      ],
      new Date("2026-01-01T00:00:00Z")
    );

    expect(statement.sql).toContain("WHEN `foundationStatus` = 'PASSED' THEN 'PASSED'");
    expect(statement.sql).toContain("`foundationRoundCount` = `foundationRoundCount` + 1");
    expect(statement.sql).toContain("GREATEST(COALESCE(`bestRoundCorrect`, 0)");
    expect(statement.sql).toContain("COALESCE(`passedAt`,");
  });
});
