import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { getExamGoal } from "@/server/services/exam-goals";
import { getFoundationProgress } from "@/server/services/foundation-training";

export async function getNextTrainingAction(user: AuthenticatedUser) {
  const goal = await getExamGoal(user);
  if (!goal) {
    return {
      stage: "SET_GOAL" as const,
      title: "先明确目标考试",
      description: "选择地区、年份和考试类型，系统将据此安排基准测试。",
      href: "/exam-goal",
      label: "设置目标考试",
    };
  }
  if (!goal.baselineSession) {
    const paper = goal.recommendedBaseline;
    return {
      stage: "BASELINE" as const,
      title: goal.inProgressBaseline ? "继续基准测试" : "完成第一次 benchmark",
      description: paper ? `建议使用 ${paper.title} 建立初始基准。` : "从现有真题中选择一套作为基准测试。",
      href: goal.inProgressBaseline ? `/practice/${goal.inProgressBaseline.id}` : "/exam-goal",
      label: goal.inProgressBaseline ? "继续答题" : "开始基准测试",
    };
  }

  const foundation = await getFoundationProgress(user);
  if (!foundation.completed && foundation.current) {
    return {
      stage: "FOUNDATION" as const,
      title: `继续筑基：${foundation.current.name}`,
      description: `固定 15 题，答对至少 9 题通过。已完成 ${foundation.passedCount}/${foundation.totalCount} 个叶子类型。`,
      href: `/question-bank/special?foundation=${foundation.current.tagId}`,
      label: "开始15题",
    };
  }

  const [postTestCount, unresolvedWrongCount] = await Promise.all([
    prisma.practiceSession.count({
      where: {
        userId: user.id,
        status: "SUBMITTED",
        purpose: { in: ["MOCK", "TIME_PRESSURE"] },
      },
    }),
    prisma.wrongQuestion.count({ where: { userId: user.id, resolvedAt: null } }),
  ]);
  if (postTestCount === 0) {
    return {
      stage: "MOCK" as const,
      title: "筑基完成，重新做一套限时真题",
      description: "对照第一次 benchmark，检查得分、用时和操作策略的变化。",
      href: "/question-bank/papers?purpose=MOCK",
      label: "选择后测试卷",
    };
  }
  if (unresolvedWrongCount > 0) {
    return {
      stage: "WRONG_REVIEW" as const,
      title: "重做待掌握错题",
      description: `当前还有 ${unresolvedWrongCount} 道待掌握错题。`,
      href: "/question-bank/wrong",
      label: "进入错题复盘",
    };
  }
  return {
    stage: "MAINTENANCE" as const,
    title: "继续薄弱类型强化",
    description: "根据最近表现选择叶子类型，或进行减时模拟。",
    href: "/question-bank/special",
    label: "选择专项",
  };
}
