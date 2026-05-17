import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  Dumbbell,
  Filter,
  Layers3,
  RotateCcw,
  Target,
} from "lucide-react";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  EmptyState,
  MetricStrip,
  PageHeader,
  StudentPage,
  TrainingPanel,
} from "@/components/student/page-building-blocks";
import { TutorPanel } from "@/features/agent/tutor-panel";
import { requireUser } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { getMistakeInsights } from "@/server/agent/mistakes/service";
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

function buildWrongHref(input: {
  tagId?: string | null;
  includeResolved?: boolean;
  mistakeCause?: string | null;
  analysis?: "analyzed" | "unanalyzed" | "all";
}) {
  const params = new URLSearchParams();

  if (input.tagId) {
    params.set("tagId", input.tagId);
  }

  if (input.includeResolved) {
    params.set("includeResolved", "true");
  }

  if (input.mistakeCause) {
    params.set("mistakeCause", input.mistakeCause);
  }

  if (input.analysis && input.analysis !== "all") {
    params.set("analysis", input.analysis);
  }

  const query = params.toString();
  return `/question-bank/wrong${query ? `?${query}` : ""}`;
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
    mistakeCause: firstValue(rawParams?.mistakeCause),
    analysis: firstValue(rawParams?.analysis),
    includeResolved: firstValue(rawParams?.includeResolved),
  });
  const [data, mistakeInsights] = await Promise.all([
    listWrongQuestions(user, query),
    getMistakeInsights(user, { range: "30", includeResolved: query.includeResolved }),
  ]);
  const hasWrongQuestions = data.summary.unresolvedCount > 0;
  const hasActiveFilters = Boolean(query.tagId || query.mistakeCause || query.analysis !== "all");
  const highRepeatCount = data.groups.reduce(
    (total, group) => total + group.items.filter((item) => item.wrongCount >= 2 && !item.resolvedAt).length,
    0
  );

  return (
    <AppShell>
      <StudentPage wide>
        <PageHeader
          eyebrow="错题本"
          title="把高频错误收拢成下一组训练"
          description="优先看重复错误和未掌握知识点，复盘入口保持在每个模块附近。"
          actions={
            <>
              {hasActiveFilters ? (
                <Link href={buildWrongHref({ includeResolved: query.includeResolved })} className={cn(buttonVariants({ variant: "outline" }))}>
                  <Filter data-icon="inline-start" />
                  清空筛选
                </Link>
              ) : null}
              <Link href="/question-bank/wrong/insights" className={cn(buttonVariants({ variant: "outline" }))}>
                <BarChart3 data-icon="inline-start" />
                错因报告
              </Link>
              <Link
                href={buildWrongHref({ includeResolved: !query.includeResolved })}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <RotateCcw data-icon="inline-start" />
                {query.includeResolved ? "只看未掌握" : "查看已掌握"}
              </Link>
            </>
          }
        />

        <MetricStrip
          items={[
            {
              label: "未掌握",
              value: data.summary.unresolvedCount,
              description: "下一组错题练习来源",
              icon: AlertTriangle,
              tone: data.summary.unresolvedCount > 0 ? "warning" : "success",
            },
            {
              label: "已掌握",
              value: data.summary.resolvedCount,
              description: "累计标记掌握",
              icon: CheckCircle2,
              tone: "success",
            },
            {
              label: "知识点",
              value: data.groups.length,
              description: data.groups[0]?.tagName ?? "暂无分组",
              icon: Layers3,
              tone: "info",
            },
            {
              label: "重复错误",
              value: highRepeatCount,
              description: "错 2 次及以上",
              icon: Target,
              tone: highRepeatCount > 0 ? "destructive" : "success",
            },
          ]}
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

        <TrainingPanel
          title="错因复盘行动"
          description="统计只按每道题最新一次结构化复盘计算；未分析错题可以继续问助教补齐。"
          icon={Brain}
          action={
            <Link href="/question-bank/wrong/insights" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              完整报告
              <ArrowRight data-icon="inline-end" />
            </Link>
          }
          tone={mistakeInsights.summary.unanalyzedCount > 0 ? "warning" : "info"}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                href={buildWrongHref({ includeResolved: query.includeResolved, analysis: "analyzed" })}
                className="rounded-lg border bg-background p-3 transition-colors hover:bg-muted/60"
              >
                <div className="text-xs text-muted-foreground">已分析</div>
                <div className="mt-1 font-mono text-2xl font-semibold">{mistakeInsights.summary.analyzedCount}</div>
                <div className="mt-1 text-xs text-muted-foreground">有结构化错因</div>
              </Link>
              <Link
                href={buildWrongHref({ includeResolved: query.includeResolved, analysis: "unanalyzed" })}
                className="rounded-lg border bg-background p-3 transition-colors hover:bg-muted/60"
              >
                <div className="text-xs text-muted-foreground">未分析</div>
                <div className="mt-1 font-mono text-2xl font-semibold">{mistakeInsights.summary.unanalyzedCount}</div>
                <div className="mt-1 text-xs text-muted-foreground">建议优先问助教</div>
              </Link>
              <div className="rounded-lg border bg-background p-3">
                <div className="text-xs text-muted-foreground">主导错因</div>
                <div className="mt-1 text-base font-semibold">
                  {mistakeInsights.summary.dominantCause?.label ?? "暂无"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {mistakeInsights.summary.dominantCause
                    ? `${mistakeInsights.summary.dominantCause.count} 道题`
                    : "先完成错因复盘"}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {mistakeInsights.distribution.length > 0 ? (
                mistakeInsights.distribution.slice(0, 6).map((item) => (
                  <Link
                    key={item.cause}
                    href={buildWrongHref({
                      includeResolved: query.includeResolved,
                      mistakeCause: item.cause,
                      analysis: "analyzed",
                    })}
                    className={cn(buttonVariants({ variant: item.cause === query.mistakeCause ? "default" : "outline", size: "sm" }))}
                  >
                    {item.label} · {item.count}
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">还没有可统计的错因。点开错题的“问助教”后，这里会自动沉淀。</p>
              )}
            </div>
          </div>
          {mistakeInsights.knowledgePatterns.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              {mistakeInsights.knowledgePatterns.slice(0, 5).map((item) => (
                <Link
                  key={`${item.tagId ?? "untagged"}-${item.cause}`}
                  href={buildWrongHref({
                    tagId: item.tagId,
                    includeResolved: query.includeResolved,
                    mistakeCause: item.cause,
                    analysis: "analyzed",
                  })}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  {item.tagName} / {item.label} · {item.count}
                </Link>
              ))}
            </div>
          ) : null}
        </TrainingPanel>

        {hasWrongQuestions || query.includeResolved ? (
          <TrainingPanel
            title="复盘优先级"
            description="模块按未掌握数量排序；重复错误越多，越适合先练一组。"
            icon={BookOpen}
          >
            {data.groups.length > 0 ? (
              <div className="flex flex-col gap-4">
              {data.groups.map((group) => (
              <details
                key={group.tagId ?? "untagged"}
                open={group.items.some((item) => item.wrongCount >= 2 && !item.resolvedAt) || data.groups.length <= 2}
                className="group rounded-lg border bg-background shadow-xs"
              >
                <summary className="cursor-pointer list-none px-4 py-3 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <h2 className="truncate text-lg font-semibold">{group.tagName}</h2>
                      <p className="text-sm text-muted-foreground">
                        {group.count} 道错题 · {group.items.filter((item) => item.wrongCount >= 2 && !item.resolvedAt).length} 道重复错误
                      </p>
                    </div>
                    <Badge variant={group.items.some((item) => item.wrongCount >= 2 && !item.resolvedAt) ? "warning" : "outline"}>
                      展开/收起
                    </Badge>
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
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-lg border bg-card px-4 py-3",
                        item.wrongCount >= 2 && !item.resolvedAt && "border-warning/40 bg-warning/5"
                      )}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap gap-2">
                            <Badge variant={item.wrongCount >= 2 && !item.resolvedAt ? "warning" : "outline"}>
                              错 {item.wrongCount} 次
                            </Badge>
                            <Badge variant={item.resolvedAt ? "success" : "warning"}>
                              {item.resolvedAt ? "已掌握" : "未掌握"}
                            </Badge>
                            <Badge variant="outline">{formatDate(item.lastWrongAt)}</Badge>
                            {item.latestMistakeReview ? (
                              <Badge variant={item.latestMistakeReview.confidence === "LOW" ? "outline" : "info"}>
                                {item.latestMistakeReview.mistakeCauseLabel}
                              </Badge>
                            ) : (
                              <Badge variant="outline">未分析错因</Badge>
                            )}
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
              </div>
            ) : (
              <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                当前筛选下没有错题。可以清空筛选，或先分析未分类错题。
              </div>
            )}
          </TrainingPanel>
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
