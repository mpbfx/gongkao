import { ArrowRight, BookMarked, CalendarCheck, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  EmptyState,
  PageHeader,
  StudentPage,
} from "@/components/student/page-building-blocks";
import { requireUser } from "@/lib/auth/guards";
import { cleanLearningTitle } from "@/lib/display-title";
import { cn } from "@/lib/utils";
import { listPracticeRecords, recordsQuerySchema } from "@/server/services/records";
import { listWrongQuestions, wrongQuestionsQuerySchema } from "@/server/services/wrong-questions";

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}分`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}小时${minutes % 60}分`;
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

  const [records, wrongQuestions] = await Promise.all([
    listPracticeRecords(user, recordsQuerySchema.parse({ pageSize: 3 })),
    listWrongQuestions(user, wrongQuestionsQuerySchema.parse({})),
  ]);
  const hasAdminAccess = user.role !== "USER";

  return (
    <AppShell>
      <StudentPage>
        <PageHeader
          eyebrow="我的学习概览"
          title={user.name ? `${user.name}，继续推进今天的训练` : "继续推进今天的训练"}
        />

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">最近复盘</h2>
              <Link href="/question-bank/records" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                全部记录
                <ArrowRight data-icon="inline-end" />
              </Link>
            </div>
            {records.items.length > 0 ? (
              <div className="flex flex-col gap-3">
                {records.items.map((record) => (
                  <Link
                    key={record.id}
                    href={`/practice/${record.id}?review=1`}
                    className="rounded-lg border bg-card px-4 py-3 shadow-xs transition-colors hover:bg-secondary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{cleanLearningTitle(record.title)}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          已答 {record.answeredCount}/{record.totalCount} · 用时 {formatDuration(record.elapsedSeconds)}
                        </div>
                      </div>
                      <Badge variant="outline">{record.accuracy ?? "0.00"}%</Badge>
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
                      {wrongQuestions.summary.unresolvedCount > 0
                        ? `${wrongQuestions.summary.unresolvedCount} 道未掌握`
                        : "暂无未掌握错题"}
                    </div>
                  </div>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </div>
            </Link>
            <Link href="/question-bank/special" className={cn(buttonVariants({ variant: "outline" }), "justify-between")}>
              进入专项提分
              <ArrowRight data-icon="inline-end" />
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
