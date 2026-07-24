import { ArrowRight, FileText, RotateCcw } from "lucide-react";
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

type RecordsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const modeFilters = [
  { label: "全部", value: "" },
  { label: "真题", value: "PAPER" },
  { label: "专项", value: "SPECIAL" },
  { label: "每日", value: "DAILY" },
  { label: "错题", value: "WRONG" },
  { label: "背题", value: "MEMORIZE" },
  { label: "回看", value: "REVIEW" },
];

const modeLabels: Record<string, string> = {
  PAPER: "历年试卷",
  SPECIAL: "专项练习",
  DAILY: "每日一练",
  WRONG: "错题练习",
  MEMORIZE: "错题复盘",
  REVIEW: "历史回看",
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  if (minutes < 60) {
    return `${minutes}分${rest}秒`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}小时${minutes % 60}分`;
}

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

function buildRecordsHref(mode: string | undefined, page: number, pageSize?: number) {
  const params = new URLSearchParams();

  if (mode) {
    params.set("mode", mode);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  if (pageSize) {
    params.set("pageSize", String(pageSize));
  }

  const query = params.toString();
  return `/question-bank/records${query ? `?${query}` : ""}`;
}

export default async function RecordsPage({ searchParams }: RecordsPageProps) {
  const user = await requireUser().catch(() => null);

  if (!user) {
    redirect("/login?callbackUrl=/question-bank/records");
  }

  const rawParams = await searchParams;
  const parsed = recordsQuerySchema.safeParse({
    mode: firstValue(rawParams?.mode),
    page: firstValue(rawParams?.page),
    pageSize: firstValue(rawParams?.pageSize),
  });
  const query = parsed.success ? parsed.data : recordsQuerySchema.parse({});
  const data = await listPracticeRecords(user, query);
  return (
    <AppShell>
      <StudentPage layout="wide" className="records-editorial-page">
        <PageHeader
          eyebrow="复盘记录"
          title="练习记录"
          summary={
            <>
              <span>累计 {data.summary.totalSessions} 次 · {data.summary.totalQuestions} 题</span>
              <span>整体正确率 {data.summary.overallAccuracy ?? "0.00"}%</span>
            </>
          }
          secondaryActions={
            query.mode ? (
              <Link href="/question-bank/records" className={cn(buttonVariants({ variant: "outline" }))}>
                <RotateCcw data-icon="inline-start" />
                清空筛选
              </Link>
            ) : null
          }
        />

        <section className="flex flex-col gap-3 border-y border-foreground/40 bg-card/25 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {modeFilters.map((filter) => {
              const isActive = (query.mode ?? "") === filter.value;

              return (
                <Link
                  key={filter.label}
                  href={buildRecordsHref(filter.value || undefined, 1, query.pageSize)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    buttonVariants({ variant: isActive ? "default" : "outline", size: "sm" }),
                    "shrink-0"
                  )}
                >
                  {filter.label}
                </Link>
              );
            })}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            第 {data.pagination.page} / {data.pagination.totalPages} 页
          </span>
        </section>

        {data.items.length > 0 ? (
          <section className="overflow-hidden border-y-2 border-foreground bg-card/35">
            <div className="hidden grid-cols-[minmax(0,1.6fr)_8rem_6rem_5.5rem_6.5rem_7rem] border-b border-foreground/30 px-4 py-3 text-xs font-semibold tracking-[0.1em] text-muted-foreground lg:grid">
              <span>练习</span>
              <span>完成时间</span>
              <span>题量</span>
              <span>正确率</span>
              <span>用时</span>
              <span className="text-right">操作</span>
            </div>
            {data.items.map((record) => (
              <article
                key={record.id}
                className="grid gap-3 border-b border-foreground/15 px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1.6fr)_8rem_6rem_5.5rem_6.5rem_7rem] lg:items-center"
              >
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{cleanLearningTitle(record.title)}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {modeLabels[record.mode] ?? record.mode}
                    <span className="lg:hidden"> · {formatDate(record.submittedAt)}</span>
                  </p>
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground lg:hidden">
                    <span>
                      已答 <strong className="font-mono text-foreground">{record.answeredCount}/{record.totalCount}</strong>
                    </span>
                    <span>
                      正确 <strong className="font-mono text-success">{record.correctCount}</strong>
                    </span>
                    <span>
                      错误 <strong className="font-mono text-destructive">{record.wrongCount}</strong>
                    </span>
                    <span>
                      用时 <strong className="font-mono text-foreground">{formatDuration(record.elapsedSeconds)}</strong>
                    </span>
                  </p>
                </div>
                <span className="hidden text-sm text-muted-foreground lg:block">{formatDate(record.submittedAt)}</span>
                <span className="hidden font-mono text-sm tabular-nums lg:block">
                  {record.answeredCount}/{record.totalCount}
                </span>
                <Badge className="w-fit" variant={Number(record.accuracy ?? 0) >= 70 ? "success" : "warning"}>
                  {record.accuracy ?? "0.00"}%
                </Badge>
                <span className="hidden font-mono text-sm tabular-nums lg:block">
                  {formatDuration(record.elapsedSeconds)}
                </span>
                <Link
                  href={`/practice/${record.id}?review=1`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "w-full justify-between lg:w-auto lg:justify-self-end"
                  )}
                >
                  回看解析
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </article>
            ))}
          </section>
        ) : (
          <EmptyState
            icon={FileText}
            title="还没有练习记录"
            description="完成并提交一套试卷后，这里会显示练习结果、解析和复盘入口。"
          >
            <Link href="/question-bank/papers" className={cn(buttonVariants({ variant: "outline" }))}>
              去刷一套试卷
              <ArrowRight data-icon="inline-end" />
            </Link>
          </EmptyState>
        )}

        {data.pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3">
            <Link
              href={buildRecordsHref(query.mode, Math.max(1, data.pagination.page - 1), query.pageSize)}
              className={cn(
                buttonVariants({ variant: "outline" }),
                data.pagination.page <= 1 && "pointer-events-none opacity-50"
              )}
            >
              上一页
            </Link>
            <span className="text-sm text-muted-foreground">
              第 {data.pagination.page} / {data.pagination.totalPages} 页
            </span>
            <Link
              href={buildRecordsHref(query.mode, Math.min(data.pagination.totalPages, data.pagination.page + 1), query.pageSize)}
              className={cn(
                buttonVariants({ variant: "outline" }),
                data.pagination.page >= data.pagination.totalPages && "pointer-events-none opacity-50"
              )}
            >
              下一页
            </Link>
          </div>
        ) : null}
      </StudentPage>
    </AppShell>
  );
}
