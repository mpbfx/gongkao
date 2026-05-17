import { ArrowRight, FileSearch, Filter, RotateCcw } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  EmptyState,
  FilterPanel,
  PageHeader,
  StudentPage,
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

  return (
    <AppShell>
      <StudentPage>
        <PageHeader
          eyebrow="历年试卷"
          title="用真题训练完整答题节奏"
          description="按年份、地区和考试类型筛选，选定试卷后进入固定题序的完整练习。"
          actions={
            <Link href="/question-bank/special" className={cn(buttonVariants({ variant: "outline" }))}>
              去专项提分
              <ArrowRight data-icon="inline-end" />
            </Link>
          }
        />

        <FilterPanel title="筛选试卷" description="筛选会刷新当前列表，清空后回到全部试卷。" icon={Filter}>
          <form className="flex flex-col gap-4 md:flex-row md:items-end">
            <FieldGroup className="grid gap-4 md:grid-cols-3">
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
            <div className="flex gap-2">
              <Button type="submit">应用筛选</Button>
              <Link href="/question-bank/papers" className={cn(buttonVariants({ variant: "outline" }))}>
                <RotateCcw data-icon="inline-start" />
                清空
              </Link>
            </div>
          </form>
        </FilterPanel>

        {data.items.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((paper) => (
              <Card key={paper.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="line-clamp-2">{paper.title}</CardTitle>
                      <CardDescription>
                        {[paper.year, paper.province, paper.examType].filter(Boolean).join(" / ")}
                      </CardDescription>
                    </div>
                    {paper.isVipOnly ? <Badge>会员</Badge> : null}
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-muted px-3 py-2">
                    <div className="text-muted-foreground">题量</div>
                    <div className="font-mono font-medium tabular-nums">{paper.questionCount} 题</div>
                  </div>
                  <div className="rounded-lg bg-muted px-3 py-2">
                    <div className="text-muted-foreground">难度</div>
                    <div className="font-mono font-medium tabular-nums">{paper.difficultyScore ?? "未评级"}</div>
                  </div>
                </CardContent>
                <CardFooter className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/question-bank/papers/${paper.id}`}
                    className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                  >
                    详情
                  </Link>
                  <PaperStartButton paperId={paper.id} className="w-full" />
                </CardFooter>
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
