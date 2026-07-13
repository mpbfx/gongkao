"use client";

import {
  BookMarked,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  History,
  LoaderCircle,
  MessageSquare,
  RotateCcw,
  Target,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { RichHtml } from "@/components/question/rich-html";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import type {
  MistakeInsights,
  WrongQuestionDTO,
  WrongQuestionGroupDTO,
  WrongQuestionsData,
} from "@/features/wrong-questions/wrong-review-types";
import { useWrongReviewActions } from "@/features/wrong-questions/use-wrong-review-actions";
import { cn } from "@/lib/utils";

type FlatWrongQuestion = {
  item: WrongQuestionDTO;
  group: WrongQuestionGroupDTO;
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

  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

function normalizeAnswer(answer?: string | null) {
  return Array.from(new Set((answer ?? "").split(",").map((part) => part.trim()).filter(Boolean)))
    .sort()
    .join(",");
}

function answerIncludes(answer: string | undefined | null, value: string) {
  return normalizeAnswer(answer).split(",").filter(Boolean).includes(value);
}

function buildWrongHref({ tagId, history = false }: { tagId?: string | null; history?: boolean }) {
  const params = new URLSearchParams();

  if (tagId) {
    params.set("tagId", tagId);
  }

  if (history) {
    params.set("includeResolved", "true");
  }

  const query = params.toString();
  return `/question-bank/wrong${query ? `?${query}` : ""}`;
}

function updateQuestionUrl(questionId: string | null, mode: "push" | "replace") {
  const url = new URL(window.location.href);

  if (questionId) {
    url.searchParams.set("questionId", questionId);
  } else {
    url.searchParams.delete("questionId");
  }

  window.history[mode === "push" ? "pushState" : "replaceState"](
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}

function WrongQuestionReview({ item }: { item: WrongQuestionDTO }) {
  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-5 2xl:px-6">
      {item.question.material ? (
        <section className="border-l-2 border-info/45 bg-muted/35 px-4 py-3" aria-label="题目材料">
          {item.question.material.title ? (
            <h3 className="student-heading mb-2 text-sm font-semibold">{item.question.material.title}</h3>
          ) : null}
          <RichHtml html={item.question.material.contentHtml} className="text-sm leading-7 text-muted-foreground" />
        </section>
      ) : null}

      <RichHtml html={item.question.titleHtml} className="mt-5 text-[0.95rem] leading-7 2xl:text-base" />

      <div className="mt-4 divide-y divide-border/80 border-y border-border/80">
        {item.question.options.map((option) => {
          const isCorrect = answerIncludes(item.question.correctAnswer, option.value);
          const isMine = answerIncludes(item.lastAnswer?.answer, option.value);

          return (
            <div
              key={option.id}
              className={cn(
                "flex min-w-0 items-start gap-3 px-3 py-3 text-sm",
                isCorrect && "bg-success/8 shadow-[inset_3px_0_0_var(--success)]",
                isMine && !isCorrect && "bg-destructive/8 shadow-[inset_3px_0_0_var(--destructive)]"
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  isCorrect && "border-success/40 text-success",
                  isMine && !isCorrect && "border-destructive/40 text-destructive"
                )}
              >
                {option.label}
              </span>
              <RichHtml html={option.contentHtml} className="min-w-0 flex-1 leading-6" />
              <div className="flex shrink-0 flex-col items-end gap-1">
                {isCorrect ? <Badge variant="success">正确答案</Badge> : null}
                {isMine && !isCorrect ? <Badge variant="destructive">我的误选</Badge> : null}
              </div>
            </div>
          );
        })}
      </div>

      <dl className="mt-4 grid grid-cols-2 divide-x divide-y border text-sm sm:grid-cols-3 sm:divide-y-0">
        <div className="px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">正确答案</dt>
          <dd className="mt-1 font-mono text-base font-semibold tabular-nums text-success">
            {item.question.correctAnswer ?? "暂无"}
          </dd>
        </div>
        <div className="px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">我的答案</dt>
          <dd className="mt-1 font-mono text-base font-semibold tabular-nums">
            {item.lastAnswer?.answer ?? "未作答"}
          </dd>
        </div>
        <div className="col-span-2 px-3 py-2.5 sm:col-span-1">
          <dt className="text-xs text-muted-foreground">最近用时</dt>
          <dd className="mt-1 font-mono text-base font-semibold tabular-nums text-info">
            {formatSeconds(item.lastAnswer?.timeSpentSeconds)}
          </dd>
        </div>
      </dl>

      <section className="mt-5 border-t-2 border-foreground/75 pt-4">
        <h3 className="student-heading text-base font-semibold">官方解析</h3>
        {item.question.analysisHtml ? (
          <RichHtml html={item.question.analysisHtml} className="mt-3 text-sm leading-7" />
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">暂无解析。</p>
        )}
      </section>

      {item.latestMistakeReview ? (
        <details className="group mt-5 border-l-2 border-info bg-info/6 px-4 py-3" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
            <span className="flex min-w-0 items-center gap-2">
              <Badge variant="info">{item.latestMistakeReview.mistakeCauseLabel}</Badge>
              <span className="truncate">{item.latestMistakeReview.causeSummary}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
          </summary>
          <dl className="mt-3 grid gap-2 border-t border-info/20 pt-3 text-sm leading-6 2xl:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">最快路径</dt>
              <dd>{item.latestMistakeReview.fastestPath}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">迁移规则</dt>
              <dd>{item.latestMistakeReview.transferRule}</dd>
            </div>
          </dl>
        </details>
      ) : null}
    </article>
  );
}

function WrongQuestionPane({
  selected,
  isRestoring,
  onRestore,
  scrollRef,
}: {
  selected: FlatWrongQuestion;
  isRestoring: boolean;
  onRestore: (item: WrongQuestionDTO) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const { item, group } = selected;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-background" aria-labelledby="wrong-question-pane-title">
      <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b bg-muted/30 px-3">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <h2 id="wrong-question-pane-title" className="shrink-0 font-semibold">题目解析</h2>
          <span className="truncate text-muted-foreground">{group.tagName}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden items-center gap-1 sm:inline-flex">
            <Clock3 className="size-3.5" aria-hidden="true" />
            {formatDate(item.lastWrongAt)}
          </span>
          <Badge variant={item.resolvedAt ? "success" : item.wrongCount >= 2 ? "warning" : "outline"}>
            错 {item.wrongCount} 次
          </Badge>
          {item.resolvedAt ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              disabled={isRestoring}
              onClick={() => onRestore(item)}
            >
              {isRestoring ? (
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
              ) : (
                <RotateCcw data-icon="inline-start" />
              )}
              恢复
            </Button>
          ) : null}
        </div>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <WrongQuestionReview item={item} />
      </div>
    </section>
  );
}

function WrongTutorPane({ item }: { item: WrongQuestionDTO }) {
  return (
    <aside className="wrong-tutor-pane flex h-full min-h-0 min-w-0 flex-col border-l bg-card" aria-labelledby="wrong-tutor-title">
      <h2 id="wrong-tutor-title" className="sr-only">讲题助教</h2>
      <TutorPanel
        key={`${item.questionId}-${item.lastAnswer?.sessionId ?? "wrong"}`}
        questionId={item.questionId}
        sessionId={item.lastAnswer?.sessionId}
        variant="dock"
        heightMode="fill"
        className="h-full min-h-0 rounded-none border-0 shadow-none"
        contextLabel={`我的答案 ${item.lastAnswer?.answer ?? "未作答"} · 正确答案 ${item.question.correctAnswer ?? "暂无"}`}
      />
    </aside>
  );
}

function WrongQueuePane({
  flatItems,
  highRepeatCount,
  insights,
  isStarting,
  knowledgeFilters,
  onSelect,
  onStart,
  query,
  selectedId,
}: {
  flatItems: FlatWrongQuestion[];
  highRepeatCount: number;
  insights: MistakeInsights;
  isStarting: boolean;
  knowledgeFilters: MistakeInsights["knowledgePatterns"];
  onSelect: (id: string, openCompact: boolean) => void;
  onStart: () => void;
  query: { tagId?: string; includeResolved: boolean };
  selectedId: string;
}) {
  const queueRef = useRef<HTMLDivElement>(null);
  const primaryPattern = insights.knowledgePatterns.find((item) => item.tagId) ?? null;

  function moveSelection(currentId: string, direction: -1 | 1) {
    const currentIndex = flatItems.findIndex(({ item }) => item.id === currentId);
    const targetIndex = Math.min(flatItems.length - 1, Math.max(0, currentIndex + direction));
    const target = flatItems[targetIndex];

    if (!target || target.item.id === currentId) {
      return;
    }

    onSelect(target.item.id, false);
    queueRef.current?.querySelector<HTMLButtonElement>(`[data-question-id="${target.item.id}"]`)?.focus();
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-col border-b bg-card xl:border-b-0 xl:border-r" aria-labelledby="wrong-queue-title">
      <div className="shrink-0 border-b bg-muted/28">
        <div className="flex h-9 items-center justify-between gap-2 border-b px-3">
          <div className="min-w-0">
            <h2 id="wrong-queue-title" className="truncate text-sm font-semibold">
              {query.includeResolved ? "历史错题" : "待复盘错题"}
            </h2>
          </div>
          <Link
            href={buildWrongHref({ history: !query.includeResolved })}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2")}
          >
            <History data-icon="inline-start" />
            {query.includeResolved ? "待复盘" : "历史"}
          </Link>
        </div>

        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              {query.includeResolved
                ? `${flatItems.length} 道已掌握`
                : `${flatItems.length} 道 · ${highRepeatCount} 道重复出错`}
            </p>
            {!query.includeResolved ? (
              <Button type="button" size="sm" className="h-7" disabled={isStarting} onClick={onStart}>
                {isStarting ? (
                  <LoaderCircle className="animate-spin" data-icon="inline-start" />
                ) : (
                  <BookMarked data-icon="inline-start" />
                )}
                重练 {Math.min(10, flatItems.length)} 题
              </Button>
            ) : null}
          </div>

          {!query.includeResolved && primaryPattern ? (
            <Link
              href={buildWrongHref({ tagId: primaryPattern.tagId })}
              className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
            >
              <span className="size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="truncate">
                优先处理 {primaryPattern.tagName} / {primaryPattern.label} · {primaryPattern.count}
              </span>
              <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
            </Link>
          ) : null}

          {!query.includeResolved && knowledgeFilters.length > 0 ? (
            <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
              {knowledgeFilters.map((item) => (
                <Link
                  key={item.tagId}
                  href={buildWrongHref({ tagId: item.tagId })}
                  className={cn(
                    buttonVariants({ variant: query.tagId === item.tagId ? "default" : "outline", size: "sm" }),
                    "h-7 shrink-0 px-2 text-xs"
                  )}
                >
                  {item.tagName}
                </Link>
              ))}
              {query.tagId ? (
                <Link
                  href="/question-bank/wrong"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 shrink-0 px-2 text-xs")}
                >
                  清除
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div ref={queueRef} className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain xl:h-0">
        {flatItems.map(({ item, group }) => {
          const active = selectedId === item.id;

          return (
            <button
              key={item.id}
              type="button"
              data-question-id={item.id}
              aria-current={active ? "true" : undefined}
              className={cn(
                "relative flex min-h-[4.75rem] w-full min-w-0 items-start gap-2.5 px-3 py-2.5 text-left [contain-intrinsic-size:76px] [content-visibility:auto] transition-colors hover:bg-muted/55 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none",
                active && "bg-primary/8 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary"
              )}
              onClick={() => onSelect(item.id, true)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  moveSelection(item.id, event.key === "ArrowDown" ? 1 : -1);
                }
              }}
            >
              <span
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  item.resolvedAt ? "bg-success" : item.wrongCount >= 2 ? "bg-warning" : "bg-primary"
                )}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium text-primary">{group.tagName}</span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                    ×{item.wrongCount}
                  </span>
                </span>
                <span className="mt-1 line-clamp-2 text-[0.82rem] leading-5">{stripHtml(item.question.titleHtml)}</span>
                <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>{formatDate(item.lastWrongAt)}</span>
                  <span className="truncate">
                    {item.resolvedAt ? "已掌握" : item.latestMistakeReview?.mistakeCauseLabel ?? "待分析"}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function WrongReviewWorkspace({
  data,
  highRepeatCount,
  insights,
  query,
}: {
  data: WrongQuestionsData;
  highRepeatCount: number;
  insights: MistakeInsights;
  query: { tagId?: string; includeResolved: boolean; questionId?: string };
}) {
  const flatItems = useMemo(
    () => data.groups.flatMap((group) => group.items.map((item) => ({ item, group }))),
    [data.groups]
  );
  const initialSelectedId = flatItems.some(({ item }) => item.id === query.questionId)
    ? (query.questionId ?? "")
    : (flatItems[0]?.item.id ?? "");
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"review" | "tutor">("review");
  const detailScrollRef = useRef<HTMLDivElement>(null);
  const mobileHistoryEntryRef = useRef(false);
  const selected = flatItems.find(({ item }) => item.id === selectedId) ?? flatItems[0] ?? null;
  const knowledgeFilters = Array.from(
    new Map(
      insights.knowledgePatterns
        .filter((item) => item.tagId)
        .map((item) => [item.tagId, item])
    ).values()
  ).slice(0, 5);
  const {
    actionError,
    clearActionError,
    clearRestoredItem,
    isStarting,
    restoredItem,
    restoringId,
    restoreWrongQuestion,
    startWrongSession,
    undoRestore,
  } = useWrongReviewActions();

  useEffect(() => {
    function handlePopState() {
      const questionId = new URL(window.location.href).searchParams.get("questionId");
      const match = flatItems.find(({ item }) => item.id === questionId);

      if (match) {
        setSelectedId(match.item.id);
        detailScrollRef.current?.scrollTo({ top: 0 });
        setMobileOpen(!window.matchMedia("(min-width: 1280px)").matches);
      } else {
        setMobileOpen(false);
      }

      mobileHistoryEntryRef.current = false;
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [flatItems]);

  function selectQuestion(id: string, openCompact: boolean) {
    const isDesktop = window.matchMedia("(min-width: 1280px)").matches;

    setSelectedId(id);
    setMobileTab("review");
    detailScrollRef.current?.scrollTo({ top: 0 });

    if (openCompact && !isDesktop) {
      updateQuestionUrl(id, "push");
      mobileHistoryEntryRef.current = true;
      setMobileOpen(true);
      return;
    }

    updateQuestionUrl(id, "replace");
    setMobileOpen(false);
  }

  function closeMobileDetail() {
    if (mobileHistoryEntryRef.current) {
      mobileHistoryEntryRef.current = false;
      window.history.back();
      return;
    }

    updateQuestionUrl(null, "replace");
    setMobileOpen(false);
  }

  if (flatItems.length === 0) {
    return (
      <section className="border bg-card p-8 text-center">
        <Target className="mx-auto text-muted-foreground" aria-hidden="true" />
        <h1 className="student-heading mt-3 text-xl font-semibold">
          {query.includeResolved ? "还没有历史错题" : "当前没有待复盘错题"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {query.includeResolved ? "答对错题后，它会自动进入这里。" : "完成练习后，答错的题会自动进入错题本。"}
        </p>
        <Link
          href={query.includeResolved ? "/question-bank/wrong" : "/question-bank/papers"}
          className={cn(buttonVariants(), "mt-5")}
        >
          {query.includeResolved ? "返回待复盘" : "去做一套真题"}
        </Link>
      </section>
    );
  }

  const sessionCount = Math.min(10, query.tagId ? flatItems.length : data.summary.unresolvedCount);

  return (
    <div className="wrong-editorial-workspace relative min-w-0 xl:h-[calc(100dvh-1.5rem)]">
      <h1 className="sr-only">错题复盘工作台</h1>

      {actionError || restoredItem ? (
        <div className="mb-3 space-y-2 xl:absolute xl:inset-x-3 xl:top-3 xl:z-20 xl:mb-0">
          {actionError ? (
            <Alert variant="destructive" className="rounded-none shadow-lg">
              <AlertTitle>操作没有完成</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
              <AlertAction>
                <Button type="button" variant="ghost" size="sm" onClick={clearActionError}>关闭</Button>
              </AlertAction>
            </Alert>
          ) : null}
          {restoredItem ? (
            <Alert variant="success" className="rounded-none shadow-lg">
              <CheckCircle2 aria-hidden="true" />
              <AlertTitle>已恢复到待复盘错题</AlertTitle>
              <AlertDescription>需要时可以立即撤销本次恢复。</AlertDescription>
              <AlertAction className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" disabled={restoringId === restoredItem.id} onClick={undoRestore}>
                  <Undo2 data-icon="inline-start" />撤销
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearRestoredItem}>关闭</Button>
              </AlertAction>
            </Alert>
          ) : null}
        </div>
      ) : null}

      <div className="min-w-0 overflow-hidden border bg-card shadow-sm xl:grid xl:h-full xl:grid-cols-[14rem_minmax(0,1fr)_21rem] 2xl:grid-cols-[17rem_minmax(0,1fr)_24rem]">
        <WrongQueuePane
          flatItems={flatItems}
          highRepeatCount={highRepeatCount}
          insights={insights}
          isStarting={isStarting}
          knowledgeFilters={knowledgeFilters}
          onSelect={selectQuestion}
          onStart={() => startWrongSession({ tagId: query.tagId, count: sessionCount })}
          query={query}
          selectedId={selected?.item.id ?? ""}
        />

        {selected ? (
          <div className="hidden min-h-0 min-w-0 xl:contents">
            <WrongQuestionPane
              selected={selected}
              isRestoring={restoringId === selected.item.id}
              onRestore={restoreWrongQuestion}
              scrollRef={detailScrollRef}
            />
            <WrongTutorPane item={selected.item} />
          </div>
        ) : null}
      </div>

      <Dialog
        open={mobileOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeMobileDetail();
          }
        }}
      >
        <DialogContent variant="sheet" className="flex h-[88dvh] max-h-[88dvh] flex-col p-0 xl:hidden">
          <DialogHeader className="border-b">
            <DialogTitle>错题复盘</DialogTitle>
            <DialogDescription>查看解析，必要时向助教追问。</DialogDescription>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mobileTab === "review" ? "default" : "outline"}
                size="sm"
                aria-pressed={mobileTab === "review"}
                onClick={() => setMobileTab("review")}
              >
                题目解析
              </Button>
              <Button
                type="button"
                variant={mobileTab === "tutor" ? "default" : "outline"}
                size="sm"
                aria-pressed={mobileTab === "tutor"}
                onClick={() => setMobileTab("tutor")}
              >
                <MessageSquare data-icon="inline-start" />问助教
              </Button>
            </div>
          </DialogHeader>
          {selected && mobileTab === "review" ? (
            <DialogBody className="min-h-0 flex-1 overflow-hidden p-0">
              <WrongQuestionPane
                selected={selected}
                isRestoring={restoringId === selected.item.id}
                onRestore={restoreWrongQuestion}
              />
            </DialogBody>
          ) : null}
          {selected && mobileTab === "tutor" ? (
            <DialogBody className="min-h-0 flex-1 overflow-hidden p-0">
              <WrongTutorPane item={selected.item} />
            </DialogBody>
          ) : null}
          <div className="shrink-0 border-t bg-muted/35 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <DialogClose className="w-full border-border bg-card text-sm font-medium hover:bg-secondary">
              收起详情
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
