import { ArrowRight, BarChart3, BookMarked, BookOpen, CalendarCheck, ClipboardList } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { buttonVariants } from "@/components/ui/button";
import {
  ActionCard,
  PageHeader,
  StudentPage,
} from "@/components/student/page-building-blocks";
import { DailyPracticeAction } from "@/features/daily-practice/daily-practice-action";
import { getCurrentUser } from "@/lib/auth/guards";
import { cleanLearningTitle } from "@/lib/display-title";
import { cn } from "@/lib/utils";
import { getTodayDailyPractice } from "@/server/services/daily-practice";
import { listWrongQuestions, wrongQuestionsQuerySchema } from "@/server/services/wrong-questions";

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
  const [dailyPractice, wrongQuestions] = user
    ? await Promise.all([
        getTodayDailyPractice(user).catch(() => null),
        listWrongQuestions(user, wrongQuestionsQuerySchema.parse({})).catch(() => null),
      ])
    : [null, null];
  const dailyTitle = dailyPractice ? cleanLearningTitle(dailyPractice.title) : null;
  const unresolvedWrongCount = wrongQuestions?.summary.unresolvedCount ?? 0;

  return (
    <AppShell>
      <StudentPage>
        <PageHeader
          eyebrow="学习工作台"
          title="今天先把一组题做扎实"
          description="先完成一组练习，再回看错题和记录。"
          actions={
            user ? (
              <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
                我的概览
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

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="flex flex-col gap-4">
            <ActionCard
              title="每日一练"
              description={
                dailyPractice
                  ? `${dailyTitle} · ${dailyPractice.questionCount} 题`
                  : "今日暂未开放练习，可先进入历年试卷。"
              }
              icon={CalendarCheck}
              badge={dailyPractice?.completedSession ? "今日已完成" : dailyPractice?.isFallback ? "最近一期" : "今日练习"}
              badgeVariant={dailyPractice?.completedSession ? "success" : "info"}
            >
              <DailyPracticeAction dailyPractice={dailyPractice} className="w-full md:w-auto" />
            </ActionCard>

            {unresolvedWrongCount > 0 ? (
              <ActionCard
                title="错题提醒"
                description={`还有 ${unresolvedWrongCount} 道未掌握错题，适合先做一组复盘。`}
                icon={BookMarked}
                badge="待复盘"
                badgeVariant="warning"
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

          <div className="grid gap-4 sm:grid-cols-2">
            {quickStarts.map((item) => (
              <ActionCard
                key={item.title}
                title={item.title}
                description={item.description}
                icon={item.icon}
                badge={item.badge}
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
