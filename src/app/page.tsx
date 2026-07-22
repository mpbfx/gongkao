import { ArrowRight, BookMarked, ClipboardList, History } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { StudentPage } from "@/components/student/page-building-blocks";
import { getCurrentUser } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { getLearningOverview } from "@/server/services/learning-overview";

function formatDate(value: string | null) {
  if (!value) {
    return "未记录";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function Home() {
  const user = await getCurrentUser();
  const overview = user ? await getLearningOverview(user) : null;
  const dailyPractice = overview?.todayTask ?? null;

  return (
    <AppShell>
      <StudentPage wide className="home-editorial-page lg:gap-0 lg:px-0 lg:pb-0 lg:pt-0">
        <section className="border-b border-foreground/25">
          <div className="flex min-h-[22rem] flex-col justify-center px-5 py-10 md:px-8 lg:min-h-[25rem] lg:px-12 xl:px-16">
              <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.22em] text-primary">
                <span>{user ? "今日训练" : "公考之路 · 精准到分"}</span>
                <span className="h-px w-12 bg-primary" />
              </div>
              <h1 className="student-heading mt-5 max-w-3xl text-[2.2rem] font-semibold leading-[1.12] tracking-[-0.03em] md:text-[2.75rem]">
                {user ? overview?.primaryAction.title ?? dailyPractice?.title ?? "从一套真题开始今天的训练" : "把每一次练习，都校准到提分上"}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
                {user
                  ? overview?.primaryAction.description
                    ?? (dailyPractice
                      ? `${dailyPractice.questionCount} 题。答案和草稿会自动保存，完成后直接进入解析与错题复盘。`
                      : "今日暂未配置每日一练，可以直接选择一套真题或进入错题复盘。")
                  : "以考点为尺，以数据为镜。完成练习、复盘错题，把时间用在真正影响得分的地方。"}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {user ? (
                  <Link href={overview?.primaryAction.href ?? "/question-bank/papers"} className={cn(buttonVariants(), "h-12 px-6 text-base")}>
                    {overview?.primaryAction.label ?? "开始训练"}
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                ) : (
                  <Link href="/login" className={cn(buttonVariants(), "h-12 px-6 text-base")}>
                    登录开始
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                )}
                <Link href="/question-bank/papers" className={cn(buttonVariants({ variant: "outline" }), "h-12 px-5")}>
                  <ClipboardList data-icon="inline-start" />
                  选择真题
                </Link>
                {user && (overview?.wrongSummary.unresolvedCount ?? 0) > 0 ? (
                  <Link href="/question-bank/wrong" className={cn(buttonVariants({ variant: "outline" }), "h-12 px-5")}>
                    <BookMarked data-icon="inline-start" />
                    复盘 {overview?.wrongSummary.unresolvedCount} 道错题
                  </Link>
                ) : null}
              </div>
          </div>

          {overview ? (
            <dl className="grid grid-cols-3 border-t border-foreground/25 bg-card/45 lg:px-10 xl:px-14">
                    {[
                      ["累计练习", overview.summary.totalSessions, "组"],
                      ["正确率", overview.summary.overallAccuracy ?? "0.00", "%"],
                      ["待复盘", overview.wrongSummary.unresolvedCount, "题"],
                    ].map(([label, value, unit]) => (
                      <div key={label} className="border-r border-foreground/20 px-3 py-4 last:border-r-0 lg:px-6">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="student-heading mt-1 text-xl font-semibold tabular-nums lg:text-2xl">
                          {value}<span className="ml-1 text-xs font-normal">{unit}</span>
                        </dd>
                      </div>
                    ))}
            </dl>
          ) : null}
        </section>

        {overview ? (
          <section className="px-5 py-6 md:px-8 lg:px-12 lg:py-8 xl:px-16">
                  <div className="flex items-center justify-between border-b-2 border-foreground pb-3">
                    <h3 className="student-heading flex items-center gap-2 font-semibold">
                      <History className="size-4" aria-hidden="true" />
                      最近练习
                    </h3>
                    <Link href="/question-bank/records" className="text-xs font-medium text-primary hover:underline">
                      查看全部
                    </Link>
                  </div>
                  <div className="divide-y divide-foreground/15 border-b border-foreground/25">
                    {overview.recentRecords.length > 0 ? overview.recentRecords.slice(0, 3).map((record) => (
                      <Link key={record.id} href={`/practice/${record.id}?review=1`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-sm hover:text-primary">
                        <span className="min-w-0">
                          <strong className="block truncate font-medium">{record.title}</strong>
                          <small className="text-muted-foreground">{formatDate(record.submittedAt)}</small>
                        </span>
                        <Badge variant={Number(record.accuracy ?? 0) >= 70 ? "success" : "warning"}>
                          {record.accuracy ?? "0.00"}%
                        </Badge>
                      </Link>
                    )) : (
                      <p className="py-6 text-sm text-muted-foreground">完成第一组练习后，这里会显示最近记录。</p>
                    )}
                  </div>
          </section>
        ) : null}
      </StudentPage>
    </AppShell>
  );
}
