import { ArrowRight, FileSearch, Gauge } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  EmptyState,
  PageHeader,
  StudentPage,
} from "@/components/student/page-building-blocks";
import { FilterPopover } from "@/components/student/interaction-overlays";
import { PaperStartButton } from "@/features/papers/paper-start-button";
import { PaperFilterForm } from "@/features/papers/paper-filter-form";
import { getCurrentUser } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { listPapers, paperListQuerySchema } from "@/server/services/papers";

type PapersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPaperPurpose(requestedPurpose: string | undefined, isBenchmark: boolean) {
  if (isBenchmark || requestedPurpose === "BASELINE") return "BASELINE" as const;
  if (requestedPurpose === "MOCK") return "MOCK" as const;
  if (requestedPurpose === "TIME_PRESSURE") return "TIME_PRESSURE" as const;
  return "PRACTICE" as const;
}

function buildHref({
  page,
  year,
  province,
  examType,
  pageSize,
}: {
  page: number;
  year?: number;
  province?: string;
  examType?: string;
  pageSize?: number;
}) {
  const params = new URLSearchParams();

  if (year) {
    params.set("year", String(year));
  }

  if (province) {
    params.set("province", province);
  }

  if (examType) {
    params.set("examType", examType);
  }

  if (pageSize) {
    params.set("pageSize", String(pageSize));
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return `/question-bank/papers${query ? `?${query}` : ""}`;
}

export default async function PapersPage({ searchParams }: PapersPageProps) {
  const rawParams = await searchParams;
  const rawPageSize = firstValue(rawParams?.pageSize);
  const benchmarkPaperId = firstValue(rawParams?.benchmark);
  const requestedPurpose = firstValue(rawParams?.purpose);
  const parsed = paperListQuerySchema.safeParse({
    year: firstValue(rawParams?.year),
    province: firstValue(rawParams?.province),
    examType: firstValue(rawParams?.examType),
    page: firstValue(rawParams?.page),
    pageSize: rawPageSize ?? 12,
  });
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 12 };
  const user = await getCurrentUser();
  const data = await listPapers(query, user?.id);
  const hasActiveFilters = Boolean(query.year || query.province || query.examType);

  return (
    <AppShell>
      <StudentPage layout="wide">
        <PageHeader
          eyebrow="历年试卷"
          title="选择一套真题开始训练"
          summary={<span>当前收录 {data.pagination.total} 套试卷</span>}
          secondaryActions={
            <Link href="/question-bank/special" className={cn(buttonVariants({ variant: "outline" }))}>
              去专项提分
              <ArrowRight data-icon="inline-end" />
            </Link>
          }
        />

        <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-y border-foreground/40 bg-card/30 px-1 py-2.5">
          <div className="flex flex-wrap items-center gap-2 px-2">
            {query.year ? <Badge variant="info">{query.year} 年</Badge> : null}
            {query.province ? <Badge variant="outline">{query.province}</Badge> : null}
            {query.examType ? <Badge variant="outline">{query.examType}</Badge> : null}
            {!hasActiveFilters ? <span className="text-sm text-muted-foreground">显示全部试卷</span> : null}
            {hasActiveFilters ? (
              <Link href="/question-bank/papers" className="text-sm text-primary hover:underline">
                清除筛选
              </Link>
            ) : null}
          </div>
          <FilterPopover label="筛选试卷" activeCount={[query.year, query.province, query.examType].filter(Boolean).length}>
            <PaperFilterForm
              key={`${query.year ?? "all"}-${query.province ?? "all"}-${query.examType ?? "all"}`}
              query={query}
              filters={data.filters}
              vertical
              idPrefix="popover"
            />
          </FilterPopover>
        </div>

        {data.items.length > 0 ? (
          <section className="overflow-hidden border-y-2 border-foreground bg-card/35">
            <div className="hidden grid-cols-[7.5rem_minmax(0,1fr)_4.5rem_5rem_9rem] border-b border-foreground/30 px-4 py-3 text-xs font-semibold tracking-[0.1em] text-muted-foreground lg:grid">
              <span>编号</span>
              <span>试卷</span>
              <span>题量</span>
              <span>难度</span>
              <span className="text-right">操作</span>
            </div>
            {data.items.map((paper) => {
              const purpose = getPaperPurpose(requestedPurpose, benchmarkPaperId === paper.id);
              const meta = [
                paper.year ? String(paper.year) : null,
                paper.province,
                paper.examType,
                paper.isVipOnly ? "会员" : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <article
                  id={`paper-${paper.id}`}
                  key={paper.id}
                  className="scroll-mt-24 grid gap-3 border-b border-foreground/15 px-4 py-4 last:border-b-0 lg:grid-cols-[7.5rem_minmax(0,1fr)_4.5rem_5rem_9rem] lg:items-center lg:gap-4"
                >
                  <div className="student-heading text-xl font-semibold tabular-nums text-foreground/85 lg:text-2xl">
                    {paper.year ?? "----"}-{String(paper.id).slice(-3).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="line-clamp-2 text-base font-semibold leading-6 md:text-[1.05rem]">{paper.title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {meta || "未标注来源"}
                      <span className="lg:hidden">
                        {" "}
                        · {paper.questionCount} 题 · 难度 {paper.difficultyScore ?? "未评级"}
                      </span>
                    </p>
                  </div>
                  <div className="hidden font-mono text-sm tabular-nums lg:block">{paper.questionCount}</div>
                  <div className="hidden items-center gap-1 text-sm font-medium lg:inline-flex">
                    <Gauge className="size-3.5 text-warning" aria-hidden="true" />
                    {paper.difficultyScore ?? "—"}
                  </div>
                  <div className="lg:justify-self-end">
                    <PaperStartButton
                      paperId={paper.id}
                      activeSession={
                        paper.activeSessions.find((session) => session.purpose === purpose)
                        ?? paper.activeSessions[0]
                        ?? null
                      }
                      submittedSession={
                        paper.submittedSessions.find((session) => session.purpose === purpose)
                        ?? paper.submittedSessions[0]
                        ?? null
                      }
                      className="w-full lg:w-auto"
                      durationSeconds={paper.durationSeconds}
                      purpose={purpose}
                    />
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <EmptyState
            icon={FileSearch}
            title="没有找到匹配试卷"
            description="换一个年份、地区或类型，或者清空筛选后查看全部试卷。"
          >
            <Link href="/question-bank/papers" className={cn(buttonVariants({ variant: "outline" }))}>
              清空筛选
            </Link>
          </EmptyState>
        )}

        {data.pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3">
            <Link
              href={buildHref({
                page: Math.max(1, data.pagination.page - 1),
                year: query.year,
                province: query.province,
                examType: query.examType,
                pageSize: rawPageSize ? query.pageSize : undefined,
              })}
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
              href={buildHref({
                page: Math.min(data.pagination.totalPages, data.pagination.page + 1),
                year: query.year,
                province: query.province,
                examType: query.examType,
                pageSize: rawPageSize ? query.pageSize : undefined,
              })}
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
