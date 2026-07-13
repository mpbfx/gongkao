import { ArrowRight, FileSearch, Filter, Gauge, MapPin } from "lucide-react";
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
      <StudentPage wide>
        <PageHeader
          eyebrow="EXAM ARCHIVE / 历年试卷"
          title="历年试卷档案馆"
          description="收录各地历年真题，按考情分门别类。以真题为纲，以实战为要。"
          actions={
            <Link href="/question-bank/special" className={cn(buttonVariants({ variant: "outline" }))}>
              去专项提分
              <ArrowRight data-icon="inline-end" />
            </Link>
          }
        />

        <details
          open={hasActiveFilters}
          className="group rounded-lg border bg-card shadow-xs md:hidden"
        >
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <span className="flex items-center gap-2 font-medium">
              <Filter className="size-4" aria-hidden="true" />
              筛选试卷
            </span>
            <Badge variant={hasActiveFilters ? "info" : "outline"}>
              {hasActiveFilters ? "已筛选" : "展开"}
            </Badge>
          </summary>
          <div className="border-t p-4">
            <PaperFilterForm query={query} filters={data.filters} idPrefix="mobile" />
          </div>
        </details>

        <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
          <aside className="hidden border-r border-foreground/30 pr-6 lg:sticky lg:top-24 lg:block">
            <div className="mb-5 border-b-2 border-foreground pb-4">
              <h2 className="student-heading flex items-center gap-2 text-xl font-semibold"><Filter className="size-5 text-primary" /> 档案筛选</h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">从年份、地区与考试类别定位卷宗。</p>
            </div>
            <PaperFilterForm query={query} filters={data.filters} vertical idPrefix="desktop" />
            <div className="mt-7 border-y border-foreground/25 py-4 text-sm">
              <span className="text-muted-foreground">当前收录</span>
              <div className="student-heading mt-1 text-3xl text-primary">{data.pagination.total}<span className="ml-1 text-sm text-foreground">份档案</span></div>
            </div>
          </aside>

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
                    <PaperStartButton paperId={paper.id} className="w-full lg:w-auto" />
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
        </div>

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
