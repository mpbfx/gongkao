import { ArrowRight, FileSearch, Gauge, MapPin } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  EmptyState,
  PageHeader,
  StudentPage,
} from "@/components/student/page-building-blocks";
import { FilterPopover } from "@/components/student/interaction-overlays";
import { PaperStartButton } from "@/features/papers/paper-start-button";
import { PaperFilterForm } from "@/features/papers/paper-filter-form";
import { cn } from "@/lib/utils";
import { listPapers, paperListQuerySchema } from "@/server/services/papers";

type PapersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
  const data = await listPapers(query);
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

        <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 border-y border-foreground/35 py-2">
          <div className="flex flex-wrap items-center gap-2">
            {query.year ? <Badge variant="info">{query.year} 年</Badge> : null}
            {query.province ? <Badge variant="outline">{query.province}</Badge> : null}
            {query.examType ? <Badge variant="outline">{query.examType}</Badge> : null}
            {!hasActiveFilters ? <span className="text-sm text-muted-foreground">显示全部试卷</span> : null}
            {hasActiveFilters ? <Link href="/question-bank/papers" className="text-sm text-primary hover:underline">清除筛选</Link> : null}
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
          <section className="flex flex-col border-t-2 border-foreground lg:gap-0">
            <div className="hidden grid-cols-[8.5rem_minmax(0,1fr)_5rem_6rem_10rem] border-b border-foreground/35 px-4 py-3 text-xs font-semibold tracking-[0.12em] text-muted-foreground lg:grid">
              <span>试卷编号</span><span>试卷名称</span><span>题量</span><span>难度</span><span className="text-right">操作</span>
            </div>
            {data.items.map((paper) => (
              <Card id={`paper-${paper.id}`} key={paper.id} className="scroll-mt-24 gap-0 lg:rounded-none lg:border-0 lg:border-b lg:border-foreground/22 lg:bg-transparent lg:shadow-none lg:last:border-b-0">
                <div className="grid gap-4 p-4 lg:grid-cols-[8.5rem_minmax(0,1fr)_5rem_6rem_10rem] lg:items-center lg:px-4 lg:py-4">
                  <div className="hidden student-heading text-2xl font-semibold tabular-nums lg:block">{paper.year ?? "----"}-{String(paper.id).slice(-3).toUpperCase()}</div>
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {paper.year ? <Badge variant="info">{paper.year}</Badge> : null}
                      {paper.province ? (
                        <Badge variant="outline">
                          <MapPin data-icon="inline-start" />
                          {paper.province}
                        </Badge>
                      ) : null}
                      {paper.examType ? <Badge variant="outline">{paper.examType}</Badge> : null}
                      {paper.isVipOnly ? <Badge>会员</Badge> : null}
                    </div>
                    <CardTitle className="line-clamp-2 text-base md:text-lg lg:font-semibold">{paper.title}</CardTitle>
                    <CardDescription className="mt-2 lg:hidden">{paper.questionCount} 题 · 难度 {paper.difficultyScore ?? "未评级"}</CardDescription>
                  </div>
                  <div className="hidden font-mono text-sm tabular-nums lg:block">
                    {paper.questionCount} 题
                  </div>
                  <div className="hidden lg:block">
                    <div className="inline-flex items-center gap-1 text-sm font-medium">
                      <Gauge className="size-3.5 text-warning" aria-hidden="true" />
                      {paper.difficultyScore ?? "未评级"}
                    </div>
                  </div>
                  <div className="grid gap-2 lg:grid-cols-1 lg:justify-items-end">
                    <PaperStartButton
                      paperId={paper.id}
                      className="w-full lg:w-auto"
                      durationSeconds={paper.durationSeconds}
                      purpose={
                        benchmarkPaperId === paper.id
                          ? "BASELINE"
                          : requestedPurpose === "BASELINE"
                            ? "BASELINE"
                          : requestedPurpose === "MOCK"
                            ? "MOCK"
                            : requestedPurpose === "TIME_PRESSURE"
                              ? "TIME_PRESSURE"
                              : "PRACTICE"
                      }
                    />
                  </div>
                </div>
              </Card>
            ))}
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
