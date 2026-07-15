import type { AuthenticatedUser } from "@/lib/auth/guards";
import { cleanLearningTitle } from "@/lib/display-title";
import { getTodayDailyPractice } from "@/server/services/daily-practice";
import { listPracticeRecords, recordsQuerySchema } from "@/server/services/records";
import {
  listWrongQuestions,
  wrongQuestionsQuerySchema,
} from "@/server/services/wrong-questions";
import { getNextTrainingAction } from "@/server/services/training-plan";

type ActionTone = "primary" | "info" | "warning" | "success";

function modeLabel(mode: string) {
  const labels: Record<string, string> = {
    PAPER: "真题",
    SPECIAL: "专项",
    DAILY: "日练",
    WRONG: "错题",
    MEMORIZE: "错题复盘",
    REVIEW: "回看",
  };

  return labels[mode] ?? mode;
}

export async function getLearningOverview(user: AuthenticatedUser) {
  const [dailyPractice, records, wrongQuestions, primaryAction] = await Promise.all([
    getTodayDailyPractice(user).catch(() => null),
    listPracticeRecords(user, recordsQuerySchema.parse({ pageSize: 3 })),
    listWrongQuestions(user, wrongQuestionsQuerySchema.parse({})),
    getNextTrainingAction(user),
  ]);
  const unresolvedWrongCount = wrongQuestions.summary.unresolvedCount;
  const recentRecords = records.items.map((record) => ({
    ...record,
    title: cleanLearningTitle(record.title),
    modeLabel: modeLabel(record.mode),
  }));
  const weakTags = wrongQuestions.groups.slice(0, 4).map((group) => ({
    tagId: group.tagId,
    tagName: group.tagName,
    count: group.count,
    highRepeatCount: group.items.filter((item) => item.wrongCount >= 2).length,
  }));
  const recommendedActions: Array<{
    key: string;
    title: string;
    description: string;
    href: string;
    label: string;
    tone: ActionTone;
  }> = [];

  if (dailyPractice && !dailyPractice.completedSession) {
    recommendedActions.push({
      key: "daily",
      title: dailyPractice.isFallback ? "补做最近一组日练" : "完成今日一练",
      description: `${cleanLearningTitle(dailyPractice.title)} · ${dailyPractice.questionCount} 题`,
      href: "/",
      label: "开始日练",
      tone: "primary",
    });
  }

  if (unresolvedWrongCount > 0) {
    recommendedActions.push({
      key: "wrong",
      title: "先消化待复盘错题",
      description: `${unresolvedWrongCount} 道未掌握，优先处理重复错误的知识点。`,
      href: "/question-bank/wrong",
      label: "进入错题",
      tone: "warning",
    });
  }

  recommendedActions.push(
    {
      key: "papers",
      title: "做一套完整真题",
      description: "用固定题序训练节奏，适合整段学习时间。",
      href: "/question-bank/papers",
      label: "选试卷",
      tone: "info",
    },
    {
      key: "special",
      title: "按薄弱点组卷",
      description: "选择知识点和题量，集中突破单个模块。",
      href: "/question-bank/special",
      label: "去组卷",
      tone: "success",
    }
  );

  return {
    todayTask: dailyPractice
      ? {
          id: dailyPractice.id,
          date: dailyPractice.date,
          requestedDate: dailyPractice.requestedDate,
          title: cleanLearningTitle(dailyPractice.title),
          questionCount: dailyPractice.questionCount,
          isFallback: dailyPractice.isFallback,
          completedSession: dailyPractice.completedSession,
          status: dailyPractice.completedSession ? "completed" : "ready",
          href: dailyPractice.completedSession
            ? `/practice/${dailyPractice.completedSession.id}?review=1`
            : "/",
          label: dailyPractice.completedSession ? "回看日练" : "开始日练",
        }
      : null,
    summary: records.summary,
    recentRecords,
    wrongSummary: wrongQuestions.summary,
    weakTags,
    recommendedActions: recommendedActions.slice(0, 4),
    primaryAction,
  };
}
