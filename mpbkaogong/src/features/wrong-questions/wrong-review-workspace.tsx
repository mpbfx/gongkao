"use client";

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Dumbbell,
  Filter,
  LoaderCircle,
  RotateCcw,
  Target,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { RichHtml } from "@/components/question/rich-html";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TutorPanel } from "@/features/agent/tutor-panel";
import { cn } from "@/lib/utils";

type LatestMistakeReview = {
  id: string;
  mistakeCause: string;
  mistakeCauseLabel: string;
  confidence: string;
  causeSummary: string;
  fastestPath: string;
  transferRule: string;
  createdAt: string;
};

type WrongQuestionItem = {
  id: string;
  questionId: string;
  wrongCount: number;
  lastWrongAt: string;
  resolvedAt: string | null;
  latestMistakeReview: LatestMistakeReview | null;
  lastAnswer: {
    answer: string | null;
    sessionId: string;
    timeSpentSeconds: number;
  } | null;
  question: {
    id: string;
    type: string;
    titleHtml: string;
    materialHtml?: string | null;
    material?: {
      id: string;
      title?: string | null;
      contentHtml: string;
    } | null;
    options: Array<{
      id: string;
      label: string;
      value: string;
      contentHtml: string;
    }>;
    correctAnswer?: string;
    analysisHtml?: string | null;
    tag?: {
      id: string;
      name: string;
    } | null;
  };
};

type WrongQuestionGroup = {
  tagId: string | null;
  tagName: string;
  count: number;
  items: WrongQuestionItem[];
};

type WrongQuestionsData = {
  summary: {
    totalCount: number;
    unresolvedCount: number;
    resolvedCount: number;
  };
  groups: WrongQuestionGroup[];
};

type WrongQueryState = {
  tagId?: string;
  mistakeCause?: string;
  analysis: "analyzed" | "unanalyzed" | "all";
  includeResolved: boolean;
};

type MistakeInsights = {
  summary: {
    unanalyzedCount: number;
    analyzedCount: number;
    dominantCause: { cause: string; label: string; count: number } | null;
  };
  distribution: Array<{ cause: string; label: string; count: number }>;
  knowledgePatterns: Array<{ tagId: string | null; tagName: string; cause: string; label: string; count: number }>;
};

type WrongSessionMode = "WRONG" | "MEMORIZE";

type ApiResponse<T> =
  | {
      ok: true;
      data: T;
      error: null;
    }
  | {
      ok: false;
      data: null;
      error: {
        message: string;
      };
    };

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

function formatSeconds(seconds?: number | null) {
  if (!seconds) {
    return "暂无";
  }

  if (seconds < 60) {
    return `${seconds} 秒`;
  }

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes} 分 ${rest} 秒`;
}

function normalizeAnswer(answer?: string | null) {
  if (!answer) {
    return "";
  }

  return Array.from(
    new Set(
      answer
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    )
  )
    .sort()
    .join(",");
}

function answerIncludes(answer: string | undefined | null, value: string) {
  return normalizeAnswer(answer).split(",").filter(Boolean).includes(value);
}

function shouldOpenDetailSheet() {
  return typeof window !== "undefined" && !window.matchMedia("(min-width: 1280px)").matches;
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

function ReviewStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "warning" | "success" | "info";
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 font-mono text-xl font-semibold tabular-nums",
          tone === "warning" && "text-warning",
          tone === "success" && "text-success",
          tone === "info" && "text-info"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function StartSessionButton({
  mode,
  tagId,
  count,
  children,
  onStart,
}: {
  mode: WrongSessionMode;
  tagId?: string | null;
  count: number;
  children: React.ReactNode;
  onStart: (input: { mode: WrongSessionMode; tagId?: string | null; count: number }) => void;
}) {
  return (
    <Button type="button" variant={mode === "MEMORIZE" ? "outline" : "default"} size="sm" disabled={count <= 0} onClick={() => onStart({ mode, tagId, count })}>
      {mode === "MEMORIZE" ? <BookOpen data-icon="inline-start" /> : <Dumbbell data-icon="inline-start" />}
      {children}
    </Button>
  );
}

function WrongQuestionDetail({
  item,
  group,
  onResolve,
  onStart,
  isResolving,
}: {
  item: WrongQuestionItem;
  group?: WrongQuestionGroup;
  onResolve: (item: WrongQuestionItem) => void;
  onStart: (input: { mode: WrongSessionMode; tagId?: string | null; count: number }) => void;
  isResolving: boolean;
}) {
  const unresolvedGroupCount = group?.items.filter((entry) => !entry.resolvedAt).length ?? 0;
  const sessionId = item.lastAnswer?.sessionId;

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <section className="rounded-lg border bg-card p-4 shadow-xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge variant={item.resolvedAt ? "success" : "warning"}>{item.resolvedAt ? "已掌握" : "未掌握"}</Badge>
              <Badge variant={item.wrongCount >= 2 && !item.resolvedAt ? "warning" : "outline"}>错 {item.wrongCount} 次</Badge>
              <Badge variant="outline">{formatDate(item.lastWrongAt)}</Badge>
              {item.latestMistakeReview ? (
                <Badge variant={item.latestMistakeReview.confidence === "LOW" ? "outline" : "info"}>
                  {item.latestMistakeReview.mistakeCauseLabel}
                </Badge>
              ) : (
                <Badge variant="outline">未分析错因</Badge>
              )}
            </div>
            <h2 className="text-lg font-semibold leading-7">{group?.tagName ?? item.question.tag?.name ?? "未分类"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">最近作答用时：{formatSeconds(item.lastAnswer?.timeSpentSeconds)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!item.resolvedAt ? (
              <Button type="button" variant="outline" size="sm" disabled={isResolving} onClick={() => onResolve(item)}>
                {isResolving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <CheckCircle2 data-icon="inline-start" />}
                标记掌握
              </Button>
            ) : null}
            <StartSessionButton mode="WRONG" tagId={group?.tagId} count={Math.min(10, unresolvedGroupCount)} onStart={onStart}>
              练本类
            </StartSessionButton>
            <StartSessionButton mode="MEMORIZE" tagId={group?.tagId} count={Math.min(10, unresolvedGroupCount)} onStart={onStart}>
              背本类
            </StartSessionButton>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-xs">
        {item.question.materialHtml ? (
          <div className="mb-4 rounded-lg border bg-muted/50 p-3">
            {item.question.material?.title ? (
              <div className="mb-2 text-sm font-medium">{item.question.material.title}</div>
            ) : null}
            <RichHtml html={item.question.materialHtml} className="text-sm leading-6 text-muted-foreground" />
          </div>
        ) : null}

        <RichHtml html={item.question.titleHtml} className="text-base leading-7" />

        <div className="mt-4 flex flex-col gap-2">
          {item.question.options.map((option) => {
            const isCorrect = answerIncludes(item.question.correctAnswer, option.value);
            const isMine = answerIncludes(item.lastAnswer?.answer, option.value);

            return (
              <div
                key={option.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border bg-background px-3 py-3 text-sm",
                  isCorrect && "border-success bg-success/10",
                  isMine && !isCorrect && "border-destructive bg-destructive/10"
                )}
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium">{option.label}</span>
                <RichHtml html={option.contentHtml} className="min-w-0 flex-1 leading-6" />
                {isCorrect ? <Badge variant="success">正确</Badge> : null}
                {isMine && !isCorrect ? <Badge variant="destructive">我的误选</Badge> : null}
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ReviewStat label="正确答案" value={item.question.correctAnswer ?? "暂无"} tone="success" />
          <ReviewStat label="我的答案" value={item.lastAnswer?.answer ?? "未作答"} tone={item.lastAnswer?.answer ? "warning" : "default"} />
          <ReviewStat label="最近用时" value={formatSeconds(item.lastAnswer?.timeSpentSeconds)} tone="info" />
        </div>

        <div className="mt-4 rounded-lg border bg-background p-3">
          <div className="mb-2 text-sm font-medium">官方解析</div>
          {item.question.analysisHtml ? (
            <RichHtml html={item.question.analysisHtml} className="text-sm leading-6 text-muted-foreground" />
          ) : (
            <p className="text-sm text-muted-foreground">暂无解析。</p>
          )}
        </div>
      </section>

      {item.latestMistakeReview ? (
        <section className="rounded-lg border border-info/30 bg-card p-4 shadow-xs">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant={item.latestMistakeReview.confidence === "LOW" ? "outline" : "info"}>
              {item.latestMistakeReview.confidence === "LOW" ? "可能错因" : "最新错因"}
            </Badge>
            <span className="text-sm font-medium">{item.latestMistakeReview.mistakeCauseLabel}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">错因摘要</div>
              <p className="mt-1 text-sm leading-6">{item.latestMistakeReview.causeSummary}</p>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">最快路径</div>
              <p className="mt-1 text-sm leading-6">{item.latestMistakeReview.fastestPath}</p>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">下次规则</div>
              <p className="mt-1 text-sm leading-6">{item.latestMistakeReview.transferRule}</p>
            </div>
          </div>
        </section>
      ) : null}

      <TutorPanel
        key={`${item.questionId}-${sessionId ?? "wrong"}`}
        questionId={item.questionId}
        sessionId={sessionId}
        variant="dock"
        contextLabel={`当前题最近答案：${item.lastAnswer?.answer ?? "未作答"}；正确答案：${item.question.correctAnswer ?? "暂无"}`}
      />
    </div>
  );
}

export function WrongReviewWorkspace({
  data,
  insights,
  query,
}: {
  data: WrongQuestionsData;
  insights: MistakeInsights;
  query: WrongQueryState;
}) {
  const router = useRouter();
  const flatItems = useMemo(
    () =>
      data.groups.flatMap((group) =>
        group.items.map((item) => ({
          item,
          group,
        }))
      ),
    [data.groups]
  );
  const [selectedId, setSelectedId] = useState(flatItems[0]?.item.id ?? "");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingSessionKey, setPendingSessionKey] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const selected = flatItems.find(({ item }) => item.id === selectedId) ?? flatItems[0] ?? null;
  const highRepeatCount = flatItems.filter(({ item }) => item.wrongCount >= 2 && !item.resolvedAt).length;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const closeSheetOnDesktop = () => {
      if (mediaQuery.matches) {
        setMobileDetailOpen(false);
      }
    };

    closeSheetOnDesktop();
    mediaQuery.addEventListener("change", closeSheetOnDesktop);

    return () => mediaQuery.removeEventListener("change", closeSheetOnDesktop);
  }, []);

  async function startWrongSession(input: { mode: WrongSessionMode; tagId?: string | null; count: number }) {
    setActionError(null);
    setPendingSessionKey(`${input.mode}:${input.tagId ?? "all"}`);

    try {
      const response = await fetch("/api/practice/sessions/wrong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: input.mode,
          tagId: input.tagId,
          count: input.count,
        }),
      });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;

      if (!payload.ok) {
        setActionError(payload.error.message);
        return;
      }

      router.push(`/practice/${payload.data.id}`);
    } catch {
      setActionError("错题练习创建失败，请稍后重试。");
    } finally {
      setPendingSessionKey(null);
    }
  }

  async function resolveWrongQuestion(item: WrongQuestionItem) {
    setActionError(null);
    setResolvingId(item.id);

    try {
      const response = await fetch(`/api/wrong-questions/${item.id}/resolve`, {
        method: "POST",
      });
      const payload = (await response.json()) as ApiResponse<{ id: string; resolvedAt: string | null }>;

      if (!payload.ok) {
        setActionError(payload.error.message);
        return;
      }

      router.refresh();
    } catch {
      setActionError("标记掌握失败，请稍后重试。");
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg border bg-card p-4 shadow-xs">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">今日复盘队列</h2>
              <Badge variant={data.summary.unresolvedCount > 0 ? "warning" : "success"}>
                {data.summary.unresolvedCount > 0 ? `${data.summary.unresolvedCount} 道未掌握` : "暂无待复盘"}
              </Badge>
              {pendingSessionKey ? (
                <Badge variant="outline">
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                  正在创建
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              先处理重复错误和未分析错题；点开列表项后，右侧会固定展示题目详情和助教追问。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StartSessionButton mode="WRONG" count={Math.min(10, data.summary.unresolvedCount)} onStart={startWrongSession}>
              开始练习
            </StartSessionButton>
            <StartSessionButton mode="MEMORIZE" count={Math.min(10, data.summary.unresolvedCount)} onStart={startWrongSession}>
              背题
            </StartSessionButton>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ReviewStat label="重复错误" value={highRepeatCount} tone={highRepeatCount > 0 ? "warning" : "success"} />
          <ReviewStat label="未分析" value={insights.summary.unanalyzedCount} tone={insights.summary.unanalyzedCount > 0 ? "warning" : "success"} />
          <ReviewStat label="主导错因" value={insights.summary.dominantCause?.label ?? "暂无"} tone={insights.summary.dominantCause ? "info" : "default"} />
        </div>
      </section>

      {actionError ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>操作没有完成</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <section className="rounded-lg border bg-card p-4 shadow-xs">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Filter aria-hidden="true" />
          筛选错题
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "unanalyzed", "analyzed"] as const).map((analysis) => (
            <Link
              key={analysis}
              href={buildWrongHref({
                tagId: query.tagId,
                includeResolved: query.includeResolved,
                mistakeCause: query.mistakeCause,
                analysis,
              })}
              className={cn(buttonVariants({ variant: query.analysis === analysis ? "default" : "outline", size: "sm" }))}
            >
              {analysis === "all" ? "全部" : analysis === "unanalyzed" ? "未分析" : "已分析"}
            </Link>
          ))}
          <Link
            href={buildWrongHref({
              tagId: query.tagId,
              includeResolved: !query.includeResolved,
              mistakeCause: query.mistakeCause,
              analysis: query.analysis,
            })}
            className={cn(buttonVariants({ variant: query.includeResolved ? "default" : "outline", size: "sm" }))}
          >
            <RotateCcw data-icon="inline-start" />
            {query.includeResolved ? "包含已掌握" : "只看未掌握"}
          </Link>
          {query.tagId || query.mistakeCause || query.analysis !== "all" ? (
            <Link href={buildWrongHref({ includeResolved: query.includeResolved })} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              清空条件
            </Link>
          ) : null}
        </div>
        {insights.distribution.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
            {insights.distribution.slice(0, 6).map((item) => (
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
            ))}
          </div>
        ) : null}
        {insights.knowledgePatterns.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
            {insights.knowledgePatterns.slice(0, 5).map((item) => (
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
      </section>

      {flatItems.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(420px,1.18fr)] xl:items-start">
          <section className="rounded-lg border bg-card shadow-xs">
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
              <div>
                <h2 className="font-semibold">错题列表</h2>
                <p className="mt-1 text-sm text-muted-foreground">只保留扫描信息，详情和助教固定在右侧。</p>
              </div>
              <Badge variant="outline">{flatItems.length} 道</Badge>
            </div>
            <div className="flex max-h-[calc(100dvh-11rem)] flex-col gap-4 overflow-y-auto p-3">
              {data.groups.map((group) => {
                const unresolvedGroupCount = group.items.filter((item) => !item.resolvedAt).length;

                return (
                  <div key={group.tagId ?? "untagged"} className="rounded-lg border bg-background">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{group.tagName}</h3>
                        <p className="text-xs text-muted-foreground">
                          {group.count} 道可见 · {unresolvedGroupCount} 道未掌握
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <StartSessionButton mode="WRONG" tagId={group.tagId} count={Math.min(10, unresolvedGroupCount)} onStart={startWrongSession}>
                          练
                        </StartSessionButton>
                        <StartSessionButton mode="MEMORIZE" tagId={group.tagId} count={Math.min(10, unresolvedGroupCount)} onStart={startWrongSession}>
                          背
                        </StartSessionButton>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      {group.items.map((item) => {
                        const active = selected?.item.id === item.id;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={cn(
                              "flex w-full items-start gap-3 border-b px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                              active && "bg-secondary"
                            )}
                            onClick={() => {
                              setSelectedId(item.id);
                              setMobileDetailOpen(shouldOpenDetailSheet());
                            }}
                          >
                            <div
                              className={cn(
                                "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border text-xs font-semibold",
                                item.resolvedAt
                                  ? "border-success/30 bg-success/10 text-success"
                                  : item.wrongCount >= 2
                                    ? "border-warning/30 bg-warning/10 text-warning"
                                    : "bg-card"
                              )}
                            >
                              {item.wrongCount}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap gap-1.5">
                                <Badge variant={item.resolvedAt ? "success" : "warning"}>{item.resolvedAt ? "已掌握" : "未掌握"}</Badge>
                                {item.latestMistakeReview ? (
                                  <Badge variant={item.latestMistakeReview.confidence === "LOW" ? "outline" : "info"}>
                                    {item.latestMistakeReview.mistakeCauseLabel}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">未分析</Badge>
                                )}
                              </div>
                              <p className="mt-2 line-clamp-2 text-sm leading-6">{stripHtml(item.question.titleHtml)}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <Clock3 aria-hidden="true" />
                                  {formatDate(item.lastWrongAt)}
                                </span>
                                <span>我的答案：{item.lastAnswer?.answer ?? "未作答"}</span>
                                <span>正确：{item.question.correctAnswer ?? "暂无"}</span>
                              </div>
                            </div>
                            <ChevronRight className="mt-1 text-muted-foreground" aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="hidden xl:block xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto">
            {selected ? (
              <WrongQuestionDetail
                item={selected.item}
                group={selected.group}
                onResolve={resolveWrongQuestion}
                onStart={startWrongSession}
                isResolving={resolvingId === selected.item.id}
              />
            ) : null}
          </aside>

          <Dialog open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
            <DialogContent variant="sheet" className="p-0 xl:hidden">
              <DialogHeader className="border-b">
                <DialogTitle>错题详情</DialogTitle>
                <DialogDescription>查看解析、错因和助教追问。</DialogDescription>
              </DialogHeader>
              <DialogBody className="max-h-[calc(82dvh-5rem)] overflow-y-auto p-4">
                {selected ? (
                  <WrongQuestionDetail
                    item={selected.item}
                    group={selected.group}
                    onResolve={resolveWrongQuestion}
                    onStart={startWrongSession}
                    isResolving={resolvingId === selected.item.id}
                  />
                ) : null}
              </DialogBody>
              <div className="border-t bg-muted/50 p-4">
                <DialogClose className="w-full border-border bg-card text-sm font-medium hover:bg-secondary hover:text-secondary-foreground">
                  收起详情
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <section className="rounded-lg border bg-card p-6 text-center shadow-xs">
          <Target className="mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-semibold">当前筛选下没有错题</h2>
          <p className="mt-2 text-sm text-muted-foreground">可以清空筛选，或先去完成一组练习。</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href={buildWrongHref({ includeResolved: query.includeResolved })} className={cn(buttonVariants({ variant: "outline" }))}>
              清空筛选
            </Link>
            <Link href="/question-bank/papers" className={cn(buttonVariants())}>
              去刷一套试卷
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
