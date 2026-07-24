import {
  ArrowRight,
  BookMarked,
  BookOpen,
  ClipboardList,
  History,
  Target,
} from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  EditorialSection,
  LedgerRow,
  QuickLinkGrid,
  StudentPage,
} from "@/components/student/page-building-blocks";
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
  const primary = overview?.primaryAction;
  const unresolved = overview?.wrongSummary.unresolvedCount ?? 0;

  if (!user || !overview) {
    return (
      <AppShell>
        <StudentPage layout="wide" className="home-editorial-page gap-6 lg:gap-8">
          <section className="border-y-2 border-foreground bg-card/40">
            <div className="grid gap-8 px-5 py-10 md:px-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-end lg:px-10 lg:py-12">
              <div>
                <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.18em] text-primary">
                  <span>公考提分</span>
                  <span className="h-px w-10 bg-primary" />
                </div>
                <h1 className="student-heading mt-4 max-w-3xl text-[2.1rem] font-semibold leading-[1.15] tracking-tight md:text-[2.6rem]">
                  把每一次练习，都校准到提分上
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                  真题、专项、错题与复盘在同一条训练链路里推进。先登录，回到你的今日任务台。
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href="/login" className={cn(buttonVariants(), "h-11 px-5")}>
                    登录开始
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                  <Link href="/question-bank/papers" className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5")}>
                    <ClipboardList data-icon="inline-start" />
                    先看试卷
                  </Link>
                </div>
              </div>
              <div className="border border-foreground/25 bg-background/50 p-5">
                <div className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">训练链路</div>
                <ol className="mt-4 space-y-3 text-sm">
                  {[
                    "可选基准卷，建立当前水平",
                    "叶子类型筑基，稳住基础分",
                    "专项与错题轮转，补齐短板",
                  ].map((step, index) => (
                    <li key={step} className="flex gap-3 border-t border-foreground/15 pt-3 first:border-t-0 first:pt-0">
                      <span className="font-mono text-xs text-primary">0{index + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          <QuickLinkGrid
            items={[
              {
                href: "/question-bank/papers",
                title: "历年试卷",
                description: "按年份和地区选题，适合整段时间完整作答。",
                label: "选题",
              },
              {
                href: "/login?callbackUrl=/question-bank/special",
                title: "专项提分",
                description: "按知识点组卷，集中突破薄弱模块。",
                label: "登录后组卷",
              },
              {
                href: "/login?callbackUrl=/question-bank/wrong",
                title: "错题复盘",
                description: "把答错的题沉淀为可追踪的掌握状态。",
                label: "登录后复盘",
              },
              {
                href: "/login?callbackUrl=/dashboard",
                title: "学习情况",
                description: "用已提交练习看正确率、薄弱点与下一步。",
                label: "登录后查看",
              },
            ]}
          />
        </StudentPage>
      </AppShell>
    );
  }

  const deskLinks = [
    {
      href: primary?.href ?? "/question-bank/papers",
      title: primary?.title ?? "开始今天的训练",
      description: primary?.description ?? "从真题、专项或日练中选一条主线推进。",
      label: primary?.label ?? "开始",
      tone: "primary" as const,
    },
    {
      href: "/question-bank/wrong",
      title: unresolved > 0 ? `复盘 ${unresolved} 道错题` : "错题本暂空",
      description: unresolved > 0 ? "优先处理重复错误的知识点，巩固正确解法。" : "继续练习后，错题会自动进入复盘。",
      label: unresolved > 0 ? "进入错题" : "查看错题本",
      tone: unresolved > 0 ? ("warning" as const) : ("default" as const),
    },
    {
      href: "/question-bank/special",
      title: "专项组卷",
      description: "选一个叶子知识点，按库存题量集中训练。",
      label: "去组卷",
      tone: "success" as const,
    },
    {
      href: "/question-bank/papers",
      title: "完整真题",
      description: "固定题序与时长压力，适合模拟整卷节奏。",
      label: "选题",
      tone: "info" as const,
    },
  ];

  return (
    <AppShell>
      <StudentPage layout="wide" className="home-editorial-page gap-5 lg:gap-6">
        <section className="border-y-2 border-foreground bg-card/45">
          <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.75fr)]">
            <div className="border-b border-foreground/20 p-5 md:p-7 lg:border-b-0 lg:border-r lg:p-8">
              <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.16em] text-primary">
                <span>今日任务台</span>
                <span className="h-px flex-1 max-w-16 bg-primary/70" />
              </div>
              <h1 className="student-heading mt-3 text-[1.85rem] font-semibold leading-[1.18] tracking-tight md:text-[2.25rem]">
                {primary?.title ?? dailyPractice?.title ?? "从一套真题开始今天的训练"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                {primary?.description
                  ?? (dailyPractice
                    ? `${dailyPractice.questionCount} 题。答案和草稿会自动保存，完成后直接进入解析与错题复盘。`
                    : "今日暂未配置每日一练，可以直接选择真题、专项或复盘错题。")}
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link href={primary?.href ?? "/question-bank/papers"} className={cn(buttonVariants(), "h-11 px-5")}>
                  {primary?.label ?? "开始训练"}
                  <ArrowRight data-icon="inline-end" />
                </Link>
                <Link href="/question-bank/papers" className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}>
                  <ClipboardList data-icon="inline-start" />
                  真题
                </Link>
                <Link href="/question-bank/special" className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}>
                  <BookOpen data-icon="inline-start" />
                  专项
                </Link>
                {unresolved > 0 ? (
                  <Link href="/question-bank/wrong" className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}>
                    <BookMarked data-icon="inline-start" />
                    错题 {unresolved}
                  </Link>
                ) : null}
              </div>
            </div>

            <aside className="grid grid-cols-2 lg:grid-cols-1">
              {[
                { label: "累计练习", value: overview.summary.totalSessions, unit: "组" },
                { label: "整体正确率", value: overview.summary.overallAccuracy ?? "—", unit: "%" },
                { label: "累计题量", value: overview.summary.totalQuestions, unit: "题" },
                { label: "待复盘", value: unresolved, unit: "题" },
              ].map((item) => (
                <div key={item.label} className="border-b border-r border-foreground/15 p-4 last:border-b-0 even:border-r-0 lg:border-r-0 lg:px-6 lg:py-5">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="student-heading mt-1 text-2xl font-semibold tabular-nums">
                    {item.value}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{item.unit}</span>
                  </div>
                </div>
              ))}
            </aside>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-6">
          <EditorialSection
            title="快速入口"
            description="按今天的时间与目标选择一条路径"
            bodyClassName="p-0"
          >
            <QuickLinkGrid items={deskLinks} className="border-0" />
          </EditorialSection>

          <EditorialSection
            title="薄弱知识点"
            description="来自错题本的当前压力点"
            action={
              <Link href="/question-bank/wrong" className="text-xs font-medium text-primary hover:underline">
                全部错题
              </Link>
            }
            bodyClassName="p-0"
          >
            {overview.weakTags.length > 0 ? (
              overview.weakTags.map((tag) => (
                <LedgerRow
                  key={tag.tagId ?? tag.tagName}
                  href={tag.tagId ? `/question-bank/wrong?tagId=${tag.tagId}` : "/question-bank/wrong"}
                  leading={
                    <span className="grid size-9 place-items-center border border-foreground/20 bg-muted/60">
                      <Target className="size-3.5" aria-hidden="true" />
                    </span>
                  }
                  title={tag.tagName}
                  meta={`${tag.count} 道待复盘${tag.highRepeatCount > 0 ? ` · ${tag.highRepeatCount} 道重复错` : ""}`}
                  trailing={<span className="text-xs font-medium text-primary">复盘</span>}
                />
              ))
            ) : (
              <p className="px-4 py-8 text-sm text-muted-foreground">还没有可归类的薄弱知识点。</p>
            )}
          </EditorialSection>
        </div>

        <EditorialSection
          title="最近练习"
          description="提交后可直接回看解析与对比"
          action={
            <Link href="/question-bank/records" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <History className="size-3.5" aria-hidden="true" />
              全部记录
            </Link>
          }
          bodyClassName="p-0"
        >
          {overview.recentRecords.length > 0 ? (
            overview.recentRecords.map((record) => (
              <LedgerRow
                key={record.id}
                href={`/practice/${record.id}?review=1`}
                title={record.title}
                meta={`${record.modeLabel ?? "练习"} · ${formatDate(record.submittedAt)}`}
                trailing={
                  <Badge variant={Number(record.accuracy ?? 0) >= 70 ? "success" : "warning"}>
                    {record.accuracy ?? "0.00"}%
                  </Badge>
                }
              />
            ))
          ) : (
            <p className="px-4 py-8 text-sm text-muted-foreground">完成第一组练习后，这里会显示最近记录。</p>
          )}
        </EditorialSection>
      </StudentPage>
    </AppShell>
  );
}
