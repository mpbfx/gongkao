import { Filter, RotateCcw } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
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
  return "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
}

function buildHref({
  page,
  year,
  province,
  examType,
}: {
  page: number;
  year?: number;
  province?: string;
  examType?: string;
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

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return `/question-bank/papers${query ? `?${query}` : ""}`;
}

export default async function PapersPage({ searchParams }: PapersPageProps) {
  const rawParams = await searchParams;
  const parsed = paperListQuerySchema.safeParse({
    year: firstValue(rawParams?.year),
    province: firstValue(rawParams?.province),
    examType: firstValue(rawParams?.examType),
    page: firstValue(rawParams?.page),
    pageSize: firstValue(rawParams?.pageSize),
  });
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 20 };
  const data = await listPapers(query);

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
        <section className="flex flex-col gap-3">
          <Badge variant="secondary" className="w-fit">
            Phase 2
          </Badge>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">历年试卷</h1>
            <p className="max-w-2xl text-muted-foreground">
              按年份、地区和考试类型筛选试卷，创建练习后进入完整答题流程。
            </p>
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter aria-hidden="true" />
              筛选
            </CardTitle>
            <CardDescription>筛选后列表会按当前条件刷新。</CardDescription>
          </CardHeader>
          <CardContent>
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
                <Button type="submit">应用</Button>
                <Link href="/question-bank/papers" className={cn(buttonVariants({ variant: "outline" }))}>
                  <RotateCcw data-icon="inline-start" />
                  清空
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            共 {data.pagination.total} 套试卷，第 {data.pagination.page} / {data.pagination.totalPages} 页
          </p>
        </section>

        {data.items.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((paper) => (
              <Card key={paper.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle>{paper.title}</CardTitle>
                    {paper.isVipOnly ? <Badge>会员</Badge> : null}
                  </div>
                  <CardDescription>
                    {[paper.year, paper.province, paper.examType].filter(Boolean).join(" / ")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <div className="text-muted-foreground">题量</div>
                      <div className="font-medium">{paper.questionCount} 题</div>
                    </div>
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <div className="text-muted-foreground">难度</div>
                      <div className="font-medium">{paper.difficultyScore ?? "未评级"}</div>
                    </div>
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
          <Card>
            <CardHeader>
              <CardTitle>没有找到匹配试卷</CardTitle>
              <CardDescription>可以清空筛选后重新查看全部试卷。</CardDescription>
            </CardHeader>
            <CardFooter>
              <Link href="/question-bank/papers" className={cn(buttonVariants({ variant: "outline" }))}>
                清空筛选
              </Link>
            </CardFooter>
          </Card>
        )}

        {data.pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3">
            <Link
              href={buildHref({
                page: Math.max(1, data.pagination.page - 1),
                year: query.year,
                province: query.province,
                examType: query.examType,
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

        <Separator />
      </main>
    </AppShell>
  );
}
