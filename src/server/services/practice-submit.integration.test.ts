import { beforeAll, describe, expect, it } from "vitest";

import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { submitPracticeSession } from "@/server/services/practice";

/**
 * 提交流程的数据库集成测试。
 *
 * 提交是全站唯一的成绩落库路径，且改用了原生批量 SQL，只有对着真实数据库跑
 * 才能覆盖计数累加、并发与 SQL 求值顺序这类问题（mock 测不出来）。
 *
 * 运行方式：
 *   RUN_DB_INTEGRATION=true DATABASE_URL=mysql://... npx vitest run src/server/services/practice-submit.integration.test.ts
 */
const runIntegration = process.env.RUN_DB_INTEGRATION === "true";

const suffix = Date.now().toString(36);
let seq = 0;

function nextId(prefix: string) {
  seq += 1;
  return `it-${prefix}-${suffix}-${seq}`;
}

async function makeUser() {
  const id = nextId("user");
  await prisma.user.create({ data: { id, email: `${id}@test.local`, name: id, role: "USER" } });

  return { id, email: `${id}@test.local`, name: id, role: "USER", image: null } as AuthenticatedUser;
}

async function makeTag() {
  const id = nextId("tag");
  await prisma.questionTag.create({
    data: { id, name: id, slug: id, depth: 1, isLeaf: true, sortOrder: 0, isActive: true },
  });

  return id;
}

async function makeQuestions(tagId: string, count: number) {
  const ids: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const id = nextId("q");
    await prisma.question.create({
      data: {
        id,
        type: "SINGLE",
        titleHtml: `<p>题目 ${index}</p>`,
        correctAnswer: "A",
        difficulty: "MEDIUM",
        tagId,
        isActive: true,
        options: {
          create: ["A", "B"].map((label, order) => ({
            id: `${id}-${label}`,
            label,
            value: label,
            contentHtml: `<p>${label}</p>`,
            sortOrder: order,
          })),
        },
      },
    });
    ids.push(id);
  }

  return ids;
}

async function makeSession(
  userId: string,
  questionIds: string[],
  purpose: "PRACTICE" | "FOUNDATION" = "PRACTICE",
  extra: Record<string, unknown> = {}
) {
  return prisma.practiceSession.create({
    data: {
      userId,
      mode: "SPECIAL",
      status: "IN_PROGRESS",
      purpose,
      title: "集成测试",
      totalCount: questionIds.length,
      unansweredCount: questionIds.length,
      ...extra,
      answers: {
        create: questionIds.map((questionId, index) => ({
          userId,
          questionId,
          sortOrder: index + 1,
          answer: null,
          isCorrect: null,
          timeSpentSeconds: 0,
        })),
      },
    },
  });
}

function submitInput(questionIds: string[], answers: Array<string | null>) {
  return {
    answers: questionIds.map((questionId, index) => ({
      questionId,
      answer: answers[index],
      timeSpentSeconds: 10 + index,
      decisionNote: null,
    })),
    events: [],
    elapsedSeconds: 100,
    pauseCount: 0,
    pausedSeconds: 0,
  } as Parameters<typeof submitPracticeSession>[2];
}

describe.runIf(runIntegration)("submitPracticeSession", () => {
  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  it("落库作答、建立错题并累计标签统计", async () => {
    const user = await makeUser();
    const tagId = await makeTag();
    const questionIds = await makeQuestions(tagId, 4);
    const session = await makeSession(user.id, questionIds);

    const result = await submitPracticeSession(
      user,
      session.id,
      submitInput(questionIds, ["A", "B", "A", null])
    );

    expect(result).toMatchObject({ correctCount: 2, wrongCount: 1, unansweredCount: 1 });

    const answers = await prisma.practiceAnswer.findMany({
      where: { sessionId: session.id },
      orderBy: { sortOrder: "asc" },
    });
    expect(answers.map((answer) => [answer.answer, answer.isCorrect, answer.timeSpentSeconds])).toEqual([
      ["A", true, 10],
      ["B", false, 11],
      ["A", true, 12],
      [null, null, 13],
    ]);
    expect(answers.map((answer) => answer.answeredAt !== null)).toEqual([true, true, true, false]);

    const wrong = await prisma.wrongQuestion.findMany({ where: { userId: user.id } });
    expect(wrong).toHaveLength(1);
    expect(wrong[0]).toMatchObject({
      questionId: questionIds[1],
      wrongCount: 1,
      tagId,
      resolvedAt: null,
      lastPracticeAnswerId: answers[1].id,
    });

    const stats = await prisma.userTagStats.findFirst({ where: { userId: user.id, tagId } });
    expect(stats).toMatchObject({ answeredCount: 3, correctCount: 2, wrongCount: 1 });
    expect(Number(stats?.accuracy)).toBe(66.67);
  });

  it("再次答错累加次数，答对移出错题本，之后再错会复活", async () => {
    const user = await makeUser();
    const tagId = await makeTag();
    const [questionId] = await makeQuestions(tagId, 1);

    const first = await makeSession(user.id, [questionId]);
    await submitPracticeSession(user, first.id, submitInput([questionId], ["B"]));
    const second = await makeSession(user.id, [questionId]);
    await submitPracticeSession(user, second.id, submitInput([questionId], ["B"]));

    let wrong = await prisma.wrongQuestion.findFirstOrThrow({ where: { userId: user.id, questionId } });
    expect(wrong.wrongCount).toBe(2);

    const stats = await prisma.userTagStats.findFirstOrThrow({ where: { userId: user.id, tagId } });
    expect(Number(stats.accuracy)).toBe(0);

    const third = await makeSession(user.id, [questionId]);
    await submitPracticeSession(user, third.id, submitInput([questionId], ["A"]));
    const resolvingAnswer = await prisma.practiceAnswer.findFirstOrThrow({
      where: { sessionId: third.id },
    });

    wrong = await prisma.wrongQuestion.findFirstOrThrow({ where: { userId: user.id, questionId } });
    expect(wrong.resolvedAt).not.toBeNull();
    expect(wrong.lastPracticeAnswerId).toBe(resolvingAnswer.id);

    const fourth = await makeSession(user.id, [questionId]);
    await submitPracticeSession(user, fourth.id, submitInput([questionId], ["B"]));

    wrong = await prisma.wrongQuestion.findFirstOrThrow({ where: { userId: user.id, questionId } });
    expect(wrong.resolvedAt).toBeNull();
    expect(wrong.wrongCount).toBe(3);
  });

  it("筑基达标即通过，且通过后不因失败一轮被降级", async () => {
    const user = await makeUser();
    const tagId = await makeTag();
    const questionIds = await makeQuestions(tagId, 15);

    const passing = await makeSession(user.id, questionIds, "FOUNDATION");
    await submitPracticeSession(
      user,
      passing.id,
      submitInput(questionIds, questionIds.map((_, index) => (index < 10 ? "A" : "B")))
    );

    const passed = await prisma.userTagStats.findFirstOrThrow({ where: { userId: user.id, tagId } });
    expect(passed).toMatchObject({
      foundationStatus: "PASSED",
      foundationRoundCount: 1,
      lastRoundCorrect: 10,
      bestRoundCorrect: 10,
    });
    expect(passed.passedAt).not.toBeNull();

    const failing = await makeSession(user.id, questionIds, "FOUNDATION");
    await submitPracticeSession(
      user,
      failing.id,
      submitInput(questionIds, questionIds.map((_, index) => (index < 3 ? "A" : "B")))
    );

    const afterFailure = await prisma.userTagStats.findFirstOrThrow({
      where: { userId: user.id, tagId },
    });
    expect(afterFailure).toMatchObject({
      foundationStatus: "PASSED",
      foundationRoundCount: 2,
      lastRoundCorrect: 3,
      bestRoundCorrect: 10,
    });
    expect(afterFailure.passedAt?.getTime()).toBe(passed.passedAt?.getTime());
  });

  it("筑基未达标记为训练中", async () => {
    const user = await makeUser();
    const tagId = await makeTag();
    const questionIds = await makeQuestions(tagId, 15);
    const session = await makeSession(user.id, questionIds, "FOUNDATION");

    await submitPracticeSession(
      user,
      session.id,
      submitInput(questionIds, questionIds.map((_, index) => (index < 5 ? "A" : "B")))
    );

    const stats = await prisma.userTagStats.findFirstOrThrow({ where: { userId: user.id, tagId } });
    expect(stats).toMatchObject({ foundationStatus: "TRAINING", passedAt: null });
  });

  it("重开会话里上一轮已判分的题沿用历史作答，成绩无法被刷高", async () => {
    const user = await makeUser();
    const tagId = await makeTag();
    const questionIds = await makeQuestions(tagId, 3);
    const session = await makeSession(user.id, questionIds, "PRACTICE", {
      sourceTagIdsJson: {
        reopenedSubmission: { submittedAt: null, gradedQuestionIds: [questionIds[0]] },
      },
    });

    await prisma.practiceAnswer.update({
      where: { sessionId_questionId: { sessionId: session.id, questionId: questionIds[0] } },
      data: { answer: "B", isCorrect: false, answeredAt: new Date() },
    });

    // 客户端谎报第一题答对
    const result = await submitPracticeSession(
      user,
      session.id,
      submitInput(questionIds, ["A", "A", "B"])
    );

    const answers = await prisma.practiceAnswer.findMany({
      where: { sessionId: session.id },
      orderBy: { sortOrder: "asc" },
    });
    expect([answers[0].answer, answers[0].isCorrect]).toEqual(["B", false]);
    expect(result).toMatchObject({ correctCount: 1, wrongCount: 2 });

    const stats = await prisma.userTagStats.findFirstOrThrow({ where: { userId: user.id, tagId } });
    expect(stats).toMatchObject({ answeredCount: 2, correctCount: 1 });
  });

  it("重复提交被拒绝", async () => {
    const user = await makeUser();
    const tagId = await makeTag();
    const questionIds = await makeQuestions(tagId, 1);
    const session = await makeSession(user.id, questionIds);

    await submitPracticeSession(user, session.id, submitInput(questionIds, ["A"]));

    await expect(
      submitPracticeSession(user, session.id, submitInput(questionIds, ["A"]))
    ).rejects.toMatchObject({ name: "ConflictError" });
  });

  it("并发提交不会丢失标签统计累加", async () => {
    const user = await makeUser();
    const tagId = await makeTag();
    const questionIds = await makeQuestions(tagId, 2);
    const sessions = [];

    for (let index = 0; index < 6; index += 1) {
      sessions.push(await makeSession(user.id, questionIds));
    }

    await Promise.all(
      sessions.map((session) =>
        submitPracticeSession(user, session.id, submitInput(questionIds, ["A", "A"]))
      )
    );

    const stats = await prisma.userTagStats.findFirstOrThrow({ where: { userId: user.id, tagId } });
    expect(stats).toMatchObject({ answeredCount: 12, correctCount: 12 });
  });
});
