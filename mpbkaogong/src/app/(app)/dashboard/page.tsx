import {
  ArrowRight,
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Clock,
  Settings,
  Target,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  EmptyState,
  MetricStrip,
  PageHeader,
  StudentPage,
  TrainingHero,
  TrainingPanel,
} from "@/components/student/page-building-blocks";
import { DailyPracticeAction } from "@/features/daily-practice/daily-practice-action";
import { requireUser } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { getLearningOverview } from "@/server/services/learning-overview";

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}分`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}小时${minutes % 60}分`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "未提交";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function roleLabel(role: string) {
  if (role === "SUPER_ADMIN") {
    return "超级管理员";
  }

  if (role === "ADMIN") {
    return "管理员";
  }

  return "学生账号";
}

export default async function DashboardPage() {
  const user = await requireUser().catch(() => null);

  if (!user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const overview = await getLearningOverview(user);
  const hasAdminAccess = user.role !== "USER";
  const primaryAction = overview.recommendedActions[0];
  const recent = overview.recentRecords[0];

  return (
    <AppShell>
      <StudentPage wide>
        <PageHeader
          eyebrow="专注训练台"
          title={user.name ? `${user.name}，继续推进今天的训练` : "继续推进今天的训练"}
          description="先处理今日任务，再用错题和记录决定下一组训练。"
        />

        <TrainingHero
          eyebrow="下一步"
          title={primaryAction.title}
          description={primaryAction.description}
          badge={overview.todayTask?.completedSession ? "今日已完成" : "待推进"}
          badgeVariant={primaryAction.tone === "warning" ? "warning" : "info"}
          actions={
            primaryAction.key === "daily" ? (
              <DailyPracticeAction dailyPractice={overview.todayTask} className="w-full md:w-auto" />
            ) : (
              <Link href={primaryAction.href} className={cn(buttonVariants({ variant: "default" }))}>
                {primaryAction.label}
                <ArrowRight data-icon="inline-end" />
              </Link>
            )
          }
        >
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <span className="block font-medium text-foreground">最近练习</span>
              <span className="text-muted-foreground">{recent ? recent.title : "暂无记录"}</span>
            </div>
            <div>
              <span className="block font-medium text-foreground">训练状态</span>
              <span className="text-muted-foreground">
                {overview.summary.totalSessions > 0
                  ? `累计 ${overview.summary.totalSessions} 次`
                  : "先完成第一组"}
              </span>
            </div>
            <div>
              <span className="block font-medium text-foreground">复盘压力</span>
              <span className="text-muted-foreground">
                {overview.wrongSummary.unresolvedCount > 0
                  ? `${overview.wrongSummary.unresolvedCount} 道待复盘`
                  : "当前清爽"}
              </span>
            </div>
          </div>
        </TrainingHero>

        <MetricStrip
          items={[
            {
              label: "累计题量",
              value: overview.summary.totalQuestions,
              description: `${overview.summary.totalSessions} 次训练`,
              icon: ClipboardList,
              tone: "info",
            },
            {
              label: "总正确率",
              value: `${overview.summary.overallAccuracy ?? "0.00"}%`,
              description: `${overview.summary.correctCount}/${overview.summary.answeredCount || overview.summary.totalQuestions || 0} 正确`,
              icon: Target,
              tone: "success",
            },
            {
              label: "待复盘错题",
              value: overview.wrongSummary.unresolvedCount,
              description: `${overview.wrongSummary.resolvedCount} 道已掌握`,
              icon: BookMarked,
              tone: overview.wrongSummary.unresolvedCount > 0 ? "warning" : "success",
            },
            {
              label: "累计用时",
              value: formatDuration(overview.summary.totalElapsedSeconds),
              description: "已提交练习",
              icon: Clock,
            },
          ]}
        />

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-4">
            <TrainingPanel
              title="最近复盘"
              description="按提交时间排列，直接回看解析和教练建议。"
              icon={BarChart3}
              action={
                <Link href="/question-bank/records" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                  全部
                  <ArrowRight data-icon="inline-end" />
                </Link>
              }
            >
              {overview.recentRecords.length > 0 ? (
                <div className="flex flex-col divide-y">
                  {overview.recentRecords.map((record) => (
                    <Link
                      key={record.id}
                      href={`/practice/${record.id}?review=1`}
                      className="grid gap-2 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{record.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {record.modeLabel} · {formatDate(record.submittedAt)} · 用时{" "}
                          {formatDuration(record.elapsedSeconds)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <Badge variant="outline">已答 {record.answeredCount}/{record.totalCount}</Badge>
                        <Badge variant={Number(record.accuracy ?? 0) >= 70 ? "success" : "warning"}>
                          {record.accuracy ?? "0.00"}%
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={CalendarCheck}
                  title="还没有可复盘的练习"
                  description="先完成一套试卷或每日一练，结果和解析会自动沉淀到这里。"
                >
                  <Link href="/question-bank/papers" className={cn(buttonVariants({ variant: "outline" }))}>
                    去刷一套试卷
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </EmptyState>
              )}
            </TrainingPanel>

            <TrainingPanel title="推荐动作" description="保持每天一组主任务，再补一个薄弱点。" icon={CalendarCheck}>
              <div className="grid gap-3 md:grid-cols-2">
                {overview.recommendedActions.map((action) => (
                  <Link
                    key={action.key}
                    href={action.href}
                    className="rounded-lg border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-secondary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium">{action.title}</div>
                        <div className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                          {action.description}
                        </div>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </div>
                  </Link>
                ))}
              </div>
            </TrainingPanel>
          </div>

          <aside className="flex flex-col gap-3">
            <div className="rounded-lg border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                  <UserRound aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{user.email ?? "已登录用户"}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{roleLabel(user.role)}</div>
                </div>
              </div>
            </div>
            <Link
              href="/question-bank/wrong"
              className="rounded-lg border bg-card p-4 shadow-xs transition-colors hover:bg-secondary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                      <BookMarked aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium">待复盘错题</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {overview.wrongSummary.unresolvedCount > 0
                        ? `${overview.wrongSummary.unresolvedCount} 道未掌握`
                        : "暂无未掌握错题"}
                    </div>
                  </div>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </div>
            </Link>
            <div className="rounded-lg border bg-card p-4 shadow-xs">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-semibold">薄弱知识点</h2>
                <Badge variant={overview.weakTags.length > 0 ? "warning" : "success"}>
                  {overview.weakTags.length > 0 ? "待处理" : "稳定"}
                </Badge>
              </div>
              {overview.weakTags.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {overview.weakTags.map((tag) => (
                    <Link
                      key={tag.tagId ?? tag.tagName}
                      href={tag.tagId ? `/question-bank/wrong?tagId=${tag.tagId}` : "/question-bank/wrong"}
                      className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2 text-sm transition-colors hover:bg-secondary"
                    >
                      <span className="min-w-0 truncate">{tag.tagName}</span>
                      <span className="font-mono text-muted-foreground">{tag.count}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  暂无未掌握错题，继续用真题和专项积累样本。
                </p>
              )}
            </div>
            <Link href="/question-bank/special" className={cn(buttonVariants({ variant: "outline" }), "justify-between")}>
              进入专项提分
              <ArrowRight data-icon="inline-end" />
            </Link>
            <Link href="/question-bank/papers" className={cn(buttonVariants({ variant: "outline" }), "justify-between")}>
              进入历年试卷
              <BookOpen data-icon="inline-end" />
            </Link>
            {hasAdminAccess ? (
              <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }), "justify-between")}>
                管理后台
                <Settings data-icon="inline-end" />
              </Link>
            ) : null}
          </aside>
        </section>
      </StudentPage>
    </AppShell>
  );
}
