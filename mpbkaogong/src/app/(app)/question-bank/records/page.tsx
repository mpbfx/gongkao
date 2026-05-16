import { ArrowRight, BarChart3, Clock, FileText, RotateCcw, Target } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { requireUser } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { listPracticeRecords, recordsQuerySchema } from "@/server/services/records";

type RecordsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const modeFilters = [
  { label: "全部", value: "" },
  { label: "历年试卷", value: "PAPER" },
  { label: "专项练习", value: "SPECIAL" },
  { label: "每日一练", value: "DAILY" },
  { label: "错题练习", value: "WRONG" },
  { label: "背题模式", value: "MEMORIZE" },
];

const modeLabels: Record<string, string> = {
  PAPER: "历年试卷",
  SPECIAL: "专项练习",
  DAILY: "每日一练",
  WRONG: "错题练习",
  MEMORIZE: "背题模式",
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
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
        <section className="flex flex-col gap-3">
          <Badge variant="secondary" className="w-fit">
            Phase 3
          </Badge>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">练习记录</h1>
            <p className="max-w-2xl text-muted-foreground">
              追踪已提交练习，回看当次题目、我的答案、正确答案和解析。
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText aria-hidden="true" />
                练习次数
              </CardTitle>
              <CardDescription>{data.summary.totalSessions} 次</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target aria-hidden="true" />
                总题量
              </CardTitle>
              <CardDescription>{data.summary.totalQuestions} 题</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 aria-hidden="true" />
                总正确率
              </CardTitle>
              <CardDescription>{data.summary.overallAccuracy ?? "0.00"}%</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock aria-hidden="true" />
                总用时
              </CardTitle>
              <CardDescription>{formatDuration(data.summary.totalElapsedSeconds)}</CardDescription>
            </CardHeader>
          </Card>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium">历史记录</h2>
            {query.mode ? (
              <Link href="/question-bank/records" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                <RotateCcw data-icon="inline-start" />
                清空筛选
              </Link>
            ) : null}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {modeFilters.map((filter) => {
              const isActive = (query.mode ?? "") === filter.value;

              return (
                <Link
                  key={filter.label}
                  href={buildRecordsHref(filter.value || undefined, 1)}
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
        </section>

        {data.items.length > 0 ? (
          <section className="flex flex-col gap-3">
            {data.items.map((record) => (
              <Card key={record.id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <CardTitle className="truncate">{record.title}</CardTitle>
                      <CardDescription>
                        {modeLabels[record.mode] ?? record.mode} · {formatDate(record.submittedAt)}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{record.accuracy ?? "0.00"}%</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <div className="text-muted-foreground">已答</div>
                      <div className="font-medium">
                        {record.answeredCount}/{record.totalCount}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <div className="text-muted-foreground">正确</div>
                      <div className="font-medium">{record.correctCount}</div>
                    </div>
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <div className="text-muted-foreground">错误</div>
                      <div className="font-medium">{record.wrongCount}</div>
                    </div>
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <div className="text-muted-foreground">未答</div>
                      <div className="font-medium">{record.unansweredCount}</div>
                    </div>
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <div className="text-muted-foreground">用时</div>
                      <div className="font-medium">{formatDuration(record.elapsedSeconds)}</div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
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
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>还没有练习记录</CardTitle>
              <CardDescription>完成并提交一套试卷后，这里会显示练习结果和复盘入口。</CardDescription>
            </CardHeader>
            <CardFooter>
              <Link href="/question-bank/papers" className={cn(buttonVariants({ variant: "outline" }))}>
                去刷一套试卷
                <ArrowRight data-icon="inline-end" />
              </Link>
            </CardFooter>
          </Card>
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

        <Separator />
      </main>
    </AppShell>
  );
}
