import { ArrowRight, Plus, Search } from "lucide-react";
import Link from "next/link";

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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { adminListQuerySchema, listAdminPapers } from "@/server/services/admin";

type AdminPapersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildHref(page: number, keyword?: string) {
  const params = new URLSearchParams();

  if (page > 1) {
    params.set("page", String(page));
  }

  if (keyword) {
    params.set("keyword", keyword);
  }

  const query = params.toString();
  return `/admin/papers${query ? `?${query}` : ""}`;
}

export default async function AdminPapersPage({ searchParams }: AdminPapersPageProps) {
  const rawParams = await searchParams;
  const query = adminListQuerySchema.parse({
    keyword: firstValue(rawParams?.keyword),
    page: firstValue(rawParams?.page),
    pageSize: firstValue(rawParams?.pageSize),
  });
  const data = await listAdminPapers(query);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <Badge variant="secondary" className="w-fit">
            试卷管理
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight">试卷列表</h1>
          <p className="max-w-2xl text-muted-foreground">创建试卷并维护题目顺序、模块和分值。</p>
        </div>
        <Link href="/admin/papers/new" className={cn(buttonVariants())}>
          <Plus data-icon="inline-start" />
          新建试卷
        </Link>
      </section>

      <form className="flex gap-2">
        <Input name="keyword" placeholder="搜索标题、地区或类型" defaultValue={query.keyword ?? ""} />
        <Button type="submit" variant="outline">
          <Search data-icon="inline-start" />
          搜索
        </Button>
      </form>

      <section className="flex flex-col gap-3">
        {data.items.map((paper) => (
          <Card key={paper.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate">{paper.title}</CardTitle>
                  <CardDescription>
                    {paper.slug} · {paper.year ?? "未知年份"} · {paper.province ?? "未设置地区"} ·{" "}
                    {paper.examType ?? "未设置类型"}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={paper.isActive ? "secondary" : "outline"}>
                    {paper.isActive ? "启用" : "停用"}
                  </Badge>
                  {paper.isVipOnly ? <Badge variant="outline">会员</Badge> : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-muted-foreground">题量</div>
                <div className="font-medium">{paper.questionCount} 题</div>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-muted-foreground">前台状态</div>
                <div className="font-medium">{paper.isActive ? "可见" : "隐藏"}</div>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-muted-foreground">创建时间</div>
                <div className="font-medium">{new Date(paper.createdAt).toLocaleDateString("zh-CN")}</div>
              </div>
            </CardContent>
            <CardFooter>
              <Link href={`/admin/papers/${paper.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
                维护题序
                <ArrowRight data-icon="inline-end" />
              </Link>
            </CardFooter>
          </Card>
        ))}
      </section>

      {data.pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Link
            href={buildHref(Math.max(1, data.pagination.page - 1), query.keyword)}
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
            href={buildHref(Math.min(data.pagination.totalPages, data.pagination.page + 1), query.keyword)}
            className={cn(
              buttonVariants({ variant: "outline" }),
              data.pagination.page >= data.pagination.totalPages && "pointer-events-none opacity-50"
            )}
          >
            下一页
          </Link>
        </div>
      ) : null}
    </main>
  );
}
