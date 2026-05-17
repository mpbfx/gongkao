import {
  ArrowRight,
  BarChart3,
  BookMarked,
  BookOpen,
  ClipboardList,
  Target,
} from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { buttonVariants } from "@/components/ui/button";
import {
  ActionCard,
  MetricStrip,
  PageHeader,
  StudentPage,
  TrainingHero,
} from "@/components/student/page-building-blocks";
import { DailyPracticeAction } from "@/features/daily-practice/daily-practice-action";
import { getCurrentUser } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { getLearningOverview } from "@/server/services/learning-overview";

const quickStarts = [
  {
    title: "历年试卷",
    description: "用真实套卷建立考试节奏，适合完整计时训练。",
    href: "/question-bank/papers",
    icon: ClipboardList,
    badge: "真题训练",
  },
  {
    title: "专项提分",
    description: "按知识点和难度组卷，把薄弱模块单独打穿。",
    href: "/question-bank/special",
    icon: BookOpen,
    badge: "灵活组卷",
  },
  {
    title: "错题本",
    description: "集中处理未掌握题目，适合碎片时间复盘。",
    href: "/question-bank/wrong",
    icon: BookMarked,
    badge: "回炉复盘",
  },
  {
    title: "复盘记录",
    description: "回看历史练习，定位正确率、用时和错题来源。",
    href: "/question-bank/records",
    icon: BarChart3,
    badge: "持续跟踪",
  },
];

export default async function Home() {
  const user = await getCurrentUser();
  const overview = user ? await getLearningOverview(user) : null;
  const dailyPractice = overview?.todayTask ?? null;
  const unresolvedWrongCount = overview?.wrongSummary.unresolvedCount ?? 0;

  return (
    <AppShell>
      <StudentPage wide={Boolean(user)}>
        <PageHeader
          eyebrow={user ? "训练入口" : "公考题库"}
          title={user ? "今天先锁定一组有效训练" : "把真题、专项和复盘放进同一个训练台"}
          description={user ? "首页保留轻入口，完整状态和复盘节奏在我的工作台里继续推进。" : "登录后进入学习工作台，直接从今日任务、真题、专项和错题复盘开始。"}
          actions={
            user ? (
              <Link href="/dashboard" className={cn(buttonVariants({ variant: "default" }))}>
                进入工作台
                <ArrowRight data-icon="inline-end" />
              </Link>
            ) : (
              <Link href="/login" className={cn(buttonVariants({ variant: "default" }))}>
                登录后开始
                <ArrowRight data-icon="inline-end" />
              </Link>
            )
          }
        />

        {overview ? (
          <MetricStrip
            items={[
              {
                label: "累计练习",
                value: overview.summary.totalSessions,
                description: `${overview.summary.totalQuestions} 题`,
                icon: ClipboardList,
                tone: "info",
              },
              {
                label: "总正确率",
                value: `${overview.summary.overallAccuracy ?? "0.00"}%`,
                description: `${overview.summary.correctCount} 正确`,
                icon: Target,
                tone: "success",
              },
              {
                label: "待复盘错题",
                value: unresolvedWrongCount,
                description: overview.weakTags[0] ? `优先：${overview.weakTags[0].tagName}` : "暂无薄弱标签",
                icon: BookMarked,
                tone: unresolvedWrongCount > 0 ? "warning" : "success",
              },
              {
                label: "最近记录",
                value: overview.recentRecords.length,
                description: overview.recentRecords[0]?.modeLabel ?? "先完成一组练习",
                icon: BarChart3,
              },
            ]}
          />
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="flex flex-col gap-4">
            <TrainingHero
              eyebrow="今日任务"
              title={dailyPractice ? dailyPractice.title : "先从一套真题建立节奏"}
              description={
                dailyPractice
                  ? `${dailyPractice.questionCount} 题 · ${dailyPractice.isFallback ? "最近一期日练" : "今日一练"}`
                  : "暂时没有可用日练时，真题训练是最稳的入口。"
              }
              badge={dailyPractice?.completedSession ? "已完成" : "可开始"}
              badgeVariant={dailyPractice?.completedSession ? "success" : "info"}
              actions={<DailyPracticeAction dailyPractice={dailyPractice} className="w-full md:w-auto" />}
            >
              <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                <div>
                  <span className="block font-medium text-foreground">主线</span>
                  日练或真题
                </div>
                <div>
                  <span className="block font-medium text-foreground">复盘</span>
                  {unresolvedWrongCount > 0 ? `${unresolvedWrongCount} 道待处理` : "暂无压力"}
                </div>
                <div>
                  <span className="block font-medium text-foreground">下一步</span>
                  {overview?.recommendedActions[0]?.title ?? "登录后生成"}
                </div>
              </div>
            </TrainingHero>

            {unresolvedWrongCount > 0 ? (
              <ActionCard
                title="错题提醒"
                description={`还有 ${unresolvedWrongCount} 道未掌握错题，适合先做一组复盘。`}
                icon={BookMarked}
                badge="待复盘"
                badgeVariant="warning"
                tone="warning"
              >
                <Link
                  href="/question-bank/wrong"
                  className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between md:w-auto")}
                >
                  去复盘
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </ActionCard>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {quickStarts.map((item) => (
              <ActionCard
                key={item.title}
                title={item.title}
                description={item.description}
                icon={item.icon}
                badge={item.badge}
                tone={item.href.includes("wrong") ? "warning" : item.href.includes("special") ? "success" : "info"}
              >
                <Link
                  href={item.href}
                  className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between")}
                >
                  进入训练
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </ActionCard>
            ))}
          </div>
        </section>
      </StudentPage>
    </AppShell>
  );
}
