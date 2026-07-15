import { ArrowRight, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { revalidatePath } from "next/cache";

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
import { requireAdmin } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import {
  adminListQuerySchema,
  listAdminQuestions,
  softDeleteAdminQuestion,
} from "@/server/services/admin";

type AdminQuestionsPageProps = {
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
  return `/admin/questions${query ? `?${query}` : ""}`;
}

async function deleteQuestionAction(formData: FormData) {
  "use server";

  await requireAdmin();
  const questionId = String(formData.get("questionId") ?? "");
  await softDeleteAdminQuestion(questionId);
  revalidatePath("/admin/questions");
}

export default async function AdminQuestionsPage({ searchParams }: AdminQuestionsPageProps) {
  const rawParams = await searchParams;
  const query = adminListQuerySchema.parse({
    keyword: firstValue(rawParams?.keyword),
    page: firstValue(rawParams?.page),
    pageSize: firstValue(rawParams?.pageSize),
  });
  const data = await listAdminQuestions(query);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <Badge variant="secondary" className="w-fit">
            题目管理
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight">题目列表</h1>
          <p className="max-w-2xl text-muted-foreground">创建、编辑和软删除题库题目。</p>
        </div>
        <Link href="/admin/questions/new" className={cn(buttonVariants())}>
          <Plus data-icon="inline-start" />
          新建题目
        </Link>
      </section>

      <form className="flex gap-2">
        <Input name="keyword" placeholder="搜索题干、来源或题目 ID" defaultValue={query.keyword ?? ""} />
        <Button type="submit" variant="outline">
          <Search data-icon="inline-start" />
          搜索
        </Button>
      </form>

      <section className="flex flex-col gap-3">
        {data.items.map((question) => (
          <Card key={question.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <CardTitle className="line-clamp-2 text-base">{question.title}</CardTitle>
                  <CardDescription>
                    {question.id} · {question.tagName} · {question.type} · {question.difficulty}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={question.isActive ? "secondary" : "outline"}>
                    {question.isActive ? "启用" : "停用"}
                  </Badge>
                  {question.isVipOnly ? <Badge variant="outline">会员</Badge> : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-muted-foreground">答案</div>
                <div className="font-medium">{question.correctAnswer}</div>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-muted-foreground">选项</div>
                <div className="font-medium">{question.optionCount} 个</div>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-muted-foreground">创建时间</div>
                <div className="font-medium">{new Date(question.createdAt).toLocaleDateString("zh-CN")}</div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap justify-between gap-2">
              <Link href={`/admin/questions/${question.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
                编辑
                <ArrowRight data-icon="inline-end" />
              </Link>
              <form action={deleteQuestionAction}>
                <input type="hidden" name="questionId" value={question.id} />
                <Button type="submit" variant="destructive">
                  <Trash2 data-icon="inline-start" />
                  软删除
                </Button>
              </form>
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
