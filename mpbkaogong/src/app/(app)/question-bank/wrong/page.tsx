import { ArrowRight, BookOpen, CheckCircle2, Dumbbell, RotateCcw, Tags } from "lucide-react";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireUser } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import {
  createWrongQuestionPracticeSession,
  listWrongQuestions,
  resolveWrongQuestion,
  wrongQuestionsQuerySchema,
} from "@/server/services/wrong-questions";

type WrongQuestionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type WrongSessionMode = "WRONG" | "MEMORIZE";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function stripHtml(html?: string | null) {
  return html?.replace(/<[^>]*>/g, "") ?? "";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function startWrongSession(formData: FormData) {
  "use server";

  const user = await requireUser();
  const mode = formData.get("mode");
  const tagId = formData.get("tagId");
  const count = formData.get("count");
  const session = await createWrongQuestionPracticeSession(user, {
    mode: mode === "MEMORIZE" ? "MEMORIZE" : "WRONG",
    tagId: typeof tagId === "string" && tagId.length > 0 ? tagId : undefined,
    count: typeof count === "string" && count.length > 0 ? Number(count) : undefined,
  });

  redirect(`/practice/${session.id}`);
}

async function resolveWrongQuestionAction(formData: FormData) {
  "use server";

  const user = await requireUser();
  const id = formData.get("id");

  if (typeof id === "string" && id.length > 0) {
    await resolveWrongQuestion(user, id);
    revalidatePath("/question-bank/wrong");
  }
}

function StartButton({
  mode,
  tagId,
  count,
  children,
}: {
  mode: WrongSessionMode;
  tagId?: string | null;
  count?: number;
  children: React.ReactNode;
}) {
  const disabled = count !== undefined && count <= 0;

  return (
    <form action={startWrongSession}>
      <input type="hidden" name="mode" value={mode} />
      {tagId ? <input type="hidden" name="tagId" value={tagId} /> : null}
      {count ? <input type="hidden" name="count" value={String(count)} /> : null}
      <Button type="submit" variant={mode === "MEMORIZE" ? "outline" : "default"} size="sm" disabled={disabled}>
        {mode === "MEMORIZE" ? <BookOpen data-icon="inline-start" /> : <Dumbbell data-icon="inline-start" />}
        {children}
      </Button>
    </form>
  );
}

export default async function WrongQuestionsPage({ searchParams }: WrongQuestionsPageProps) {
  const user = await requireUser().catch(() => null);

  if (!user) {
    redirect("/login?callbackUrl=/question-bank/wrong");
  }

  const rawParams = await searchParams;
  const query = wrongQuestionsQuerySchema.parse({
    tagId: firstValue(rawParams?.tagId),
    includeResolved: firstValue(rawParams?.includeResolved),
  });
  const data = await listWrongQuestions(user, query);
  const hasWrongQuestions = data.summary.unresolvedCount > 0;

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
        <section className="flex flex-col gap-3">
          <Badge variant="secondary" className="w-fit">
            Phase 5
          </Badge>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">我的错题</h1>
            <p className="max-w-2xl text-muted-foreground">
              按知识点整理未掌握题目，可直接进入错题练习，也可以用背题模式先看答案和解析。
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tags aria-hidden="true" />
                未掌握
              </CardTitle>
              <CardDescription>{data.summary.unresolvedCount} 题</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 aria-hidden="true" />
                已掌握
              </CardTitle>
              <CardDescription>{data.summary.resolvedCount} 题</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen aria-hidden="true" />
                总错题
              </CardTitle>
              <CardDescription>{data.summary.totalCount} 题</CardDescription>
            </CardHeader>
          </Card>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <StartButton mode="WRONG" count={Math.min(10, data.summary.unresolvedCount)}>
              开始练习
            </StartButton>
            <StartButton mode="MEMORIZE" count={Math.min(10, data.summary.unresolvedCount)}>
              背题
            </StartButton>
          </div>
          <Link
            href={query.includeResolved ? "/question-bank/wrong" : "/question-bank/wrong?includeResolved=true"}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <RotateCcw data-icon="inline-start" />
            {query.includeResolved ? "只看未掌握" : "查看已掌握"}
          </Link>
        </section>

        {hasWrongQuestions || query.includeResolved ? (
          <section className="flex flex-col gap-4">
            {data.groups.map((group) => (
              <details key={group.tagId ?? "untagged"} open className="group rounded-lg border bg-card">
                <summary className="cursor-pointer list-none px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <h2 className="truncate text-lg font-medium">{group.tagName}</h2>
                      <p className="text-sm text-muted-foreground">{group.count} 道错题</p>
                    </div>
                    <Badge variant="outline">展开</Badge>
                  </div>
                </summary>

                <div className="flex flex-wrap gap-2 border-t px-4 py-3">
                  <StartButton mode="WRONG" tagId={group.tagId} count={Math.min(10, group.count)}>
                    练习本类
                  </StartButton>
                  <StartButton mode="MEMORIZE" tagId={group.tagId} count={Math.min(10, group.count)}>
                    背本类
                  </StartButton>
                </div>

                <div className="flex flex-col gap-3 border-t p-4">
                  {group.items.map((item) => (
                    <div key={item.id} className="rounded-lg border px-4 py-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap gap-2">
                            <Badge variant="outline">错 {item.wrongCount} 次</Badge>
                            <Badge variant={item.resolvedAt ? "secondary" : "outline"}>
                              {item.resolvedAt ? "已掌握" : "未掌握"}
                            </Badge>
                            <Badge variant="outline">{formatDate(item.lastWrongAt)}</Badge>
                          </div>
                          <h3 className="line-clamp-2 text-sm leading-6">{stripHtml(item.question.titleHtml)}</h3>
                          <p className="mt-2 text-sm text-muted-foreground">
                            正确答案：{item.question.correctAnswer ?? "暂无"}
                          </p>
                        </div>
                        {!item.resolvedAt ? (
                          <form action={resolveWrongQuestionAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <Button type="submit" variant="outline" size="sm">
                              <CheckCircle2 data-icon="inline-start" />
                              标记掌握
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </section>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>暂时没有错题</CardTitle>
              <CardDescription>提交练习后，答错的题会自动进入这里。</CardDescription>
            </CardHeader>
            <CardFooter>
              <Link href="/question-bank/papers" className={cn(buttonVariants({ variant: "outline" }))}>
                去刷一套试卷
                <ArrowRight data-icon="inline-end" />
              </Link>
            </CardFooter>
          </Card>
        )}

        <Separator />
      </main>
    </AppShell>
  );
}
