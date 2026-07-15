import { ArrowRight, FileText, RotateCcw } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  { label: "错题", value: "WRONG" },
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

function buildRecordsHref(mode: string | undefined, page: number) {
  const params = new URLSearchParams();

  if (mode) {
    params.set("mode", mode);
  }

  if (page > 1) {
    params.set("page", String(page));
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

        <section className="flex flex-col gap-3 border-y border-foreground/35 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {modeFilters.map((filter) => {
              const isActive = (query.mode ?? "") === filter.value;

              return (
                <Link
                  key={filter.label}
                  href={buildRecordsHref(filter.value || undefined, 1)}
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
          <span className="shrink-0 text-xs text-muted-foreground">第 {data.pagination.page} / {data.pagination.totalPages} 页</span>
        </section>

        {data.items.length > 0 ? (
          <>
          <section className="hidden overflow-hidden rounded-xl border bg-card shadow-xs lg:block">
            <div className="grid grid-cols-[minmax(320px,1.5fr)_180px_140px_120px_150px_110px] border-b bg-foreground px-5 py-3 text-xs font-medium text-background">
              <span>练习名称</span>
              <span>完成时间</span>
              <span>完成题数</span>
              <span>正确率</span>
              <span>用时</span>
              <span className="text-right">操作</span>
            </div>
            {data.items.map((record) => (
              <div
                key={record.id}
                className="grid grid-cols-[minmax(320px,1.5fr)_180px_140px_120px_150px_110px] items-center border-b px-5 py-4 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{cleanLearningTitle(record.title)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{modeLabels[record.mode] ?? record.mode}</div>
                </div>
                <span className="text-sm text-muted-foreground">{formatDate(record.submittedAt)}</span>
                <span className="font-mono text-sm tabular-nums">{record.answeredCount}/{record.totalCount}</span>
                <Badge className="w-fit" variant={Number(record.accuracy ?? 0) >= 70 ? "success" : "warning"}>
                  {record.accuracy ?? "0.00"}%
                </Badge>
                <span className="font-mono text-sm tabular-nums">{formatDuration(record.elapsedSeconds)}</span>
                <Link
                  href={`/practice/${record.id}?review=1`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "justify-self-end")}
                >
                  回看解析
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-3 lg:hidden">
            {data.items.map((record) => (
              <Card key={record.id} className="lg:rounded-none lg:border-0 lg:border-b lg:bg-transparent lg:shadow-none lg:last:border-b-0">
                <CardHeader className="lg:pb-0">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <CardTitle className="truncate">{cleanLearningTitle(record.title)}</CardTitle>
                      <CardDescription>
                        {modeLabels[record.mode] ?? record.mode} · {formatDate(record.submittedAt)}
                      </CardDescription>
                    </div>
                    <Badge variant={Number(record.accuracy ?? 0) >= 70 ? "success" : "warning"}>{record.accuracy ?? "0.00"}%</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm text-muted-foreground">
                  <span>已答 <strong className="font-mono text-foreground">{record.answeredCount}/{record.totalCount}</strong></span>
                  <span>正确 <strong className="font-mono text-success">{record.correctCount}</strong></span>
                  <span>错误 <strong className="font-mono text-destructive">{record.wrongCount}</strong></span>
                  <span>用时 <strong className="font-mono text-foreground">{formatDuration(record.elapsedSeconds)}</strong></span>
                </CardContent>
                <CardFooter className="lg:border-t-0 lg:bg-transparent lg:pt-0">
                  <Link
                    href={`/practice/${record.id}?review=1`}
                    className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between md:w-auto")}
                  >
                    回看解析
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </section>
          </>
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
              href={buildRecordsHref(query.mode, Math.max(1, data.pagination.page - 1))}
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
              href={buildRecordsHref(query.mode, Math.min(data.pagination.totalPages, data.pagination.page + 1))}
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
