import { ArrowRight, BookOpen, CheckCircle2, Dumbbell, RotateCcw } from "lucide-react";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  EmptyState,
  PageHeader,
  StudentPage,
} from "@/components/student/page-building-blocks";
import { TutorPanel } from "@/features/agent/tutor-panel";
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
      <StudentPage>
        <PageHeader
          eyebrow="错题本"
          title="把高频错误收拢成下一组训练"
          description="按知识点查看未掌握题目，可直接进入错题练习，也可以先背题看解析。"
          actions={
            <Link
              href={query.includeResolved ? "/question-bank/wrong" : "/question-bank/wrong?includeResolved=true"}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <RotateCcw data-icon="inline-start" />
              {query.includeResolved ? "只看未掌握" : "查看已掌握"}
            </Link>
          }
        />

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-xs">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">快速开始</h2>
              <Badge variant={data.summary.unresolvedCount > 0 ? "warning" : "success"}>
                {data.summary.unresolvedCount > 0 ? `${data.summary.unresolvedCount} 道未掌握` : "暂无待复盘"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.summary.unresolvedCount > 0
                ? "默认抽取最多 10 道未掌握错题，适合碎片时间复盘。"
                : "提交练习后，答错的题会自动进入这里。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StartButton mode="WRONG" count={Math.min(10, data.summary.unresolvedCount)}>
              开始练习
            </StartButton>
            <StartButton mode="MEMORIZE" count={Math.min(10, data.summary.unresolvedCount)}>
              背题
            </StartButton>
          </div>
        </section>

        {hasWrongQuestions || query.includeResolved ? (
          <section className="flex flex-col gap-4">
            {data.groups.map((group) => (
              <details key={group.tagId ?? "untagged"} open className="group rounded-lg border bg-card shadow-xs">
                <summary className="cursor-pointer list-none px-4 py-3 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <h2 className="truncate text-lg font-semibold">{group.tagName}</h2>
                      <p className="text-sm text-muted-foreground">{group.count} 道错题</p>
                    </div>
                    <Badge variant="outline">展开/收起</Badge>
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
                    <div key={item.id} className="rounded-lg border bg-background px-4 py-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap gap-2">
                            <Badge variant="outline">错 {item.wrongCount} 次</Badge>
                            <Badge variant={item.resolvedAt ? "success" : "warning"}>
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
                      <div className="mt-3">
                        <TutorPanel questionId={item.questionId} />
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </section>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="暂时没有错题"
            description="提交练习后，答错的题会自动进入这里，后续可按知识点专项消化。"
          >
            <Link href="/question-bank/papers" className={cn(buttonVariants({ variant: "outline" }))}>
              去刷一套试卷
              <ArrowRight data-icon="inline-end" />
            </Link>
          </EmptyState>
        )}
      </StudentPage>
    </AppShell>
  );
}
