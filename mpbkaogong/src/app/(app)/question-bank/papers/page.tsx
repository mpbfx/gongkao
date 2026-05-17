import { ArrowRight, FileSearch, Filter, Gauge, MapPin, RotateCcw } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  EmptyState,
  PageHeader,
  StudentPage,
  TrainingPanel,
} from "@/components/student/page-building-blocks";
import { PaperStartButton } from "@/features/papers/paper-start-button";
import { cn } from "@/lib/utils";
import { listPapers, paperListQuerySchema } from "@/server/services/papers";

type PapersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function selectClassName() {
  return "h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 lg:h-8 lg:px-2.5 lg:text-sm";
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

function PaperFilterForm({
  query,
  data,
}: {
  query: {
    year?: number;
    province?: string;
    examType?: string;
  };
  data: Awaited<ReturnType<typeof listPapers>>;
}) {
  return (
    <form className="grid gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] md:items-end">
      <FieldGroup className="grid gap-3 md:contents">
        <Field>
          <FieldLabel htmlFor="year">年份</FieldLabel>
          <select id="year" name="year" defaultValue={query.year ?? ""} className={selectClassName()}>
            <option value="">全部年份</option>
            {data.filters.years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="province">地区</FieldLabel>
          <select
            id="province"
            name="province"
            defaultValue={query.province ?? ""}
            className={selectClassName()}
          >
            <option value="">全部地区</option>
            {data.filters.provinces.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="examType">类型</FieldLabel>
          <select
            id="examType"
            name="examType"
            defaultValue={query.examType ?? ""}
            className={selectClassName()}
          >
            <option value="">全部类型</option>
            {data.filters.examTypes.map((examType) => (
              <option key={examType} value={examType}>
                {examType}
              </option>
            ))}
          </select>
        </Field>
      </FieldGroup>
      <div className="flex gap-2 md:justify-end">
        <Button type="submit">应用</Button>
        <Link href="/question-bank/papers" className={cn(buttonVariants({ variant: "outline" }))}>
          <RotateCcw data-icon="inline-start" />
          清空
        </Link>
      </div>
    </form>
  );
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
          eyebrow="历年试卷"
          title="用真题训练完整答题节奏"
          description="筛选只承担定位任务，列表优先展示能立即开始练习的关键信息。"
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
            <PaperFilterForm query={query} data={data} />
          </div>
        </details>

        <TrainingPanel
          title="筛选试卷"
          description={`共 ${data.pagination.total} 套可用试卷，默认每页显示 ${data.pagination.pageSize} 套。`}
          icon={Filter}
          className="hidden md:block"
        >
          <PaperFilterForm query={query} data={data} />
        </TrainingPanel>

        {data.items.length > 0 ? (
          <section className="flex flex-col gap-3">
            {data.items.map((paper) => (
              <Card key={paper.id} className="gap-0">
                <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
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
                    <CardTitle className="line-clamp-2 text-base md:text-lg">{paper.title}</CardTitle>
                    <CardDescription className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      <span>{paper.questionCount} 题</span>
                      <span className="inline-flex items-center gap-1">
                        <Gauge className="size-3.5" aria-hidden="true" />
                        难度 {paper.difficultyScore ?? "未评级"}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="grid grid-cols-2 gap-2 lg:w-56">
                    <Link
                      href={`/question-bank/papers/${paper.id}`}
                      className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                    >
                      详情
                    </Link>
                    <PaperStartButton paperId={paper.id} className="w-full" />
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
