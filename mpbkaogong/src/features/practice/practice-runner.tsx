"use client";

import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  LoaderCircle,
  Pause,
  PencilLine,
  Play,
  Send,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAppHeader } from "@/components/layout/app-header-context";
import { DraftCanvas } from "@/components/practice/draft-canvas";
import { RichHtml } from "@/components/question/rich-html";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  clearPracticeDraft,
  getPracticeDraft,
  savePracticeDraft,
  type PracticeScratchDraft,
  type PracticeSubmitDraft,
} from "@/lib/offline/practice-drafts";
import { cleanLearningTitle } from "@/lib/display-title";
import { cn } from "@/lib/utils";
import { CoachDiagnosisCard } from "@/features/agent/coach-diagnosis-card";
import { TutorPanel } from "@/features/agent/tutor-panel";

type PracticeQuestion = {
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
  sectionName?: string | null;
  sortOrder: number;
};

type UserAnswer = {
  questionId: string;
  answer: string | null;
  isCorrect: boolean | null;
  timeSpentSeconds: number;
};

type PracticeSessionView = {
  id: string;
  title: string;
  mode: string;
  status: string;
  totalCount: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  elapsedSeconds: number;
  accuracy: string | null;
  questions: PracticeQuestion[];
  userAnswers: UserAnswer[];
};

type SubmitResult = {
  sessionId: string;
  title: string;
  totalCount: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  accuracy: string | null;
  elapsedSeconds: number;
  answers: Array<{
    questionId: string;
    answer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
    timeSpentSeconds: number;
    analysisHtml?: string | null;
  }>;
};

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
        code: string;
        message: string;
        details: unknown;
      };
    };

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

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function stripHtml(html?: string | null) {
  return html?.replace(/<[^>]*>/g, "") ?? "";
}

function questionStatusLabel(status: "answered" | "correct" | "wrong" | "default") {
  if (status === "correct") {
    return "正确";
  }

  if (status === "wrong") {
    return "错误";
  }

  if (status === "answered") {
    return "已答";
  }

  return "未答";
}

function optionStateLabel(state: "selected" | "correct" | "wrong" | "default") {
  if (state === "correct") {
    return "正确答案";
  }

  if (state === "wrong") {
    return "我的误选";
  }

  if (state === "selected") {
    return "已选择";
  }

  return null;
}

export function PracticeRunner({
  initialSession,
  reviewMode = false,
}: {
  initialSession: PracticeSessionView;
  reviewMode?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(initialSession.elapsedSeconds);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialSession.userAnswers
        .filter((answer) => answer.answer)
        .map((answer) => [answer.questionId, answer.answer ?? ""])
    )
  );
  const [timeSpentByQuestionId, setTimeSpentByQuestionId] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      initialSession.userAnswers.map((answer) => [answer.questionId, answer.timeSpentSeconds])
    )
  );
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showDraftCanvas, setShowDraftCanvas] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [hasPendingSubmit, setHasPendingSubmit] = useState(false);
  const [scratchByQuestionId, setScratchByQuestionId] = useState<Record<string, PracticeScratchDraft>>({});
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof window === "undefined" ? true : window.navigator.onLine
  );
  const appHeader = useAppHeader();

  const questions = initialSession.questions;
  const question = questions[currentIndex];
  const isMemorizeMode = initialSession.mode === "MEMORIZE";
  const answeredCount = Object.values(answers).filter((answer) => normalizeAnswer(answer).length > 0).length;
  const completionRate = questions.length > 0 ? answeredCount / questions.length : 0;
  const isResultMode = initialSession.status === "SUBMITTED" || isMemorizeMode || Boolean(submitResult);
  const isPracticePaused = !isResultMode && isPaused;
  const currentScratch = scratchByQuestionId[question.id] ?? null;
  const resultByQuestionId = useMemo(() => {
    const map = new Map<
      string,
      {
        answer: string | null;
        correctAnswer?: string;
        isCorrect: boolean | null;
        analysisHtml?: string | null;
      }
    >();

    for (const answer of initialSession.userAnswers) {
      const matchedQuestion = questions.find((item) => item.id === answer.questionId);
      map.set(answer.questionId, {
        answer: answer.answer,
        correctAnswer: matchedQuestion?.correctAnswer,
        isCorrect: answer.isCorrect,
        analysisHtml: matchedQuestion?.analysisHtml,
      });
    }

    for (const answer of submitResult?.answers ?? []) {
      map.set(answer.questionId, answer);
    }

    return map;
  }, [initialSession.userAnswers, questions, submitResult]);
  const answerGroups = useMemo(() => {
    const groups = new Map<
      string,
      Array<{
        question: PracticeQuestion;
        index: number;
      }>
    >();

    questions.forEach((item, index) => {
      const sectionName = item.sectionName ?? "综合";
      const group = groups.get(sectionName) ?? [];
      group.push({ question: item, index });
      groups.set(sectionName, group);
    });

    return Array.from(groups.entries()).map(([name, items]) => ({ name, items }));
  }, [questions]);
  const currentResult = resultByQuestionId.get(question.id);

  useEffect(() => {
    if (isResultMode || isPracticePaused) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
      setTimeSpentByQuestionId((current) => ({
        ...current,
        [question.id]: (current[question.id] ?? 0) + 1,
      }));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isResultMode, isPracticePaused, question.id]);

  function updateAnswer(value: string) {
    if (isResultMode || isPracticePaused) {
      return;
    }

    setAnswers((current) => {
      const previous = normalizeAnswer(current[question.id]);

      if (question.type === "MULTIPLE") {
        const nextValues = new Set(previous ? previous.split(",") : []);

        if (nextValues.has(value)) {
          nextValues.delete(value);
        } else {
          nextValues.add(value);
        }

        return {
          ...current,
          [question.id]: Array.from(nextValues).sort().join(","),
        };
      }

      return {
        ...current,
        [question.id]: value,
      };
    });
  }

  function saveLocalPracticeDraft(
    nextScratchByQuestionId = scratchByQuestionId,
    pendingSubmit: PracticeSubmitDraft | null = hasPendingSubmit ? buildSubmitDraft() : null
  ) {
    return savePracticeDraft({
      sessionId: initialSession.id,
      currentIndex,
      answers,
      elapsedSeconds,
      timeSpentByQuestionId,
      scratchByQuestionId: nextScratchByQuestionId,
      pendingSubmit,
    });
  }

  function updateCurrentScratch(value: PracticeScratchDraft | null) {
    const nextScratchByQuestionId = { ...scratchByQuestionId };

    if (value) {
      nextScratchByQuestionId[question.id] = value;
    } else {
      delete nextScratchByQuestionId[question.id];
    }

    setScratchByQuestionId(nextScratchByQuestionId);
    void saveLocalPracticeDraft(nextScratchByQuestionId);
  }

  function goToQuestion(index: number) {
    void saveLocalPracticeDraft();
    setShowDraftCanvas(false);
    setShowAnswerSheet(false);
    setCurrentIndex(Math.min(Math.max(index, 0), Math.max(questions.length - 1, 0)));
  }

  function togglePause() {
    if (isResultMode) {
      return;
    }

    setIsPaused((current) => !current);
  }

  async function submitPractice() {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const submitDraft = buildSubmitDraft();

      if (!isOnline) {
        await savePendingSubmitDraft();
        setSubmitError("当前网络不可用，提交草稿已保留，请在网络恢复后重试。");
        setShowSubmitDialog(false);
        return;
      }

      const response = await fetch(`/api/practice/sessions/${initialSession.id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitDraft),
      });
      const payload = (await response.json()) as ApiResponse<SubmitResult>;

      if (!payload.ok) {
        setSubmitError(payload.error.message);
        return;
      }

      setSubmitResult(payload.data);
      setHasPendingSubmit(false);
      setShowSubmitDialog(false);
      if (Object.keys(scratchByQuestionId).length > 0) {
        await saveLocalPracticeDraft(scratchByQuestionId, null);
      } else {
        await clearPracticeDraft(initialSession.id);
      }
    } catch {
      await savePendingSubmitDraft();
      setSubmitError("提交失败，答案已保留，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  function optionState(value: string) {
    const selected = normalizeAnswer(isResultMode ? currentResult?.answer : answers[question.id])
      .split(",")
      .filter(Boolean)
      .includes(value);
    const isCorrectOption = normalizeAnswer(currentResult?.correctAnswer)
      .split(",")
      .filter(Boolean)
      .includes(value);

    if (!isResultMode) {
      return selected ? "selected" : "default";
    }

    if (isCorrectOption) {
      return "correct";
    }

    if (selected && !isCorrectOption) {
      return "wrong";
    }

    return "default";
  }

  const resultSummary = submitResult
    ? submitResult
    : isResultMode
      ? {
          totalCount: initialSession.totalCount,
          answeredCount: initialSession.answeredCount,
          correctCount: initialSession.correctCount,
          wrongCount: initialSession.wrongCount,
          unansweredCount: initialSession.unansweredCount,
          accuracy: initialSession.accuracy,
          elapsedSeconds: initialSession.elapsedSeconds,
        }
      : null;

  function questionStatus(item: PracticeQuestion) {
    const result = resultByQuestionId.get(item.id);
    const isAnswered = normalizeAnswer(isResultMode ? result?.answer : answers[item.id]).length > 0;

    if (!isResultMode) {
      return isAnswered ? "answered" : "default";
    }

    if (result?.isCorrect === true) {
      return "correct";
    }

    if (result?.isCorrect === false) {
      return "wrong";
    }

    return isAnswered ? "answered" : "default";
  }

  function answerButtonClassName(item: PracticeQuestion, index: number) {
    const status = questionStatus(item);

    return cn(
      "grid size-9 shrink-0 place-items-center rounded-md border text-xs font-medium transition-colors",
      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      index === currentIndex && "border-primary ring-2 ring-primary/20",
      !isResultMode && status === "answered" && "bg-primary text-primary-foreground",
      isResultMode && status === "answered" && "bg-primary text-primary-foreground",
      isResultMode && status === "correct" && "border-success bg-success/10 text-success",
      isResultMode && status === "wrong" && "border-destructive bg-destructive/10 text-destructive"
    );
  }

  const answerLegend = isResultMode
    ? [
        { label: "正确", className: "border-success bg-success/10" },
        { label: "错误", className: "border-destructive bg-destructive/10" },
        { label: "未答", className: "bg-background" },
      ]
    : [
        { label: "已答", className: "bg-primary" },
        { label: "未答", className: "bg-background" },
        { label: "当前", className: "border-primary ring-2 ring-primary/20" },
      ];

  const answerSheetContent = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium">
            <Grid3X3 className="size-4" aria-hidden="true" />
            答题卡
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isMemorizeMode ? `共 ${questions.length} 题` : `已答 ${answeredCount} / ${questions.length}`}
          </p>
        </div>
        <Badge variant="outline">{Math.round(completionRate * 100)}%</Badge>
      </div>
      <div className="h-1.5 shrink-0 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(completionRate * 100)}%` }} />
      </div>
      <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-2 text-xs text-muted-foreground">
        {answerLegend.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm border", item.className)} />
            {item.label}
          </span>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {answerGroups.map((group) => {
          const currentGroup = group.items.some((item) => item.index === currentIndex);

          return (
            <details key={group.name} open={currentGroup || answerGroups.length <= 3} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-1 py-1 text-sm font-medium hover:bg-muted">
                <span className="truncate">{group.name}</span>
                <span className="text-xs text-muted-foreground">{group.items.length} 题</span>
              </summary>
              <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-2">
                {group.items.map(({ question: item, index }) => (
                  <button
                    key={`${group.name}-${item.id}-${index}`}
                    type="button"
                    className={answerButtonClassName(item, index)}
                    title={stripHtml(item.titleHtml)}
                    aria-label={`第 ${index + 1} 题，${questionStatusLabel(questionStatus(item))}`}
                    aria-current={index === currentIndex ? "true" : undefined}
                    onClick={() => goToQuestion(index)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </>
  );

  const actionBarPrimaryText = isResultMode
    ? `第 ${currentIndex + 1} / ${questions.length} 题`
    : `已答 ${answeredCount} / ${questions.length}`;
  const actionBarSecondaryText = isResultMode
    ? resultSummary
      ? `正确率 ${resultSummary.accuracy ?? "0.00"}%`
      : "结果回看"
    : isPracticePaused
      ? "已暂停"
      : formatSeconds(elapsedSeconds);
  const headerSubtitle = `第 ${currentIndex + 1} / ${questions.length} 题${
    question.sectionName ? ` · ${question.sectionName}` : ""
  }`;

  useEffect(() => {
    appHeader?.setHeader({
      title: cleanLearningTitle(initialSession.title),
      subtitle: headerSubtitle,
    });

    return () => appHeader?.setHeader(null);
  }, [appHeader, headerSubtitle, initialSession.title]);

  useEffect(() => {
    function updateOnlineState() {
      setIsOnline(window.navigator.onLine);
    }

    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);

    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreDraft() {
      const draft = await getPracticeDraft(initialSession.id);

      if (cancelled) {
        return;
      }

      if (draft) {
        const questionIds = new Set(questions.map((item) => item.id));
        const restoredScratch = Object.fromEntries(
          Object.entries(draft.scratchByQuestionId ?? {}).filter(([questionId]) => questionIds.has(questionId))
        );
        setScratchByQuestionId(restoredScratch);

        if (isResultMode) {
          setIsDraftReady(true);
          return;
        }

        const restoredAnswers = Object.fromEntries(
          Object.entries(draft.answers).filter(([questionId]) => questionIds.has(questionId))
        );
        const restoredTimeSpent = Object.fromEntries(
          Object.entries(draft.timeSpentByQuestionId).filter(([questionId]) => questionIds.has(questionId))
        );

        setAnswers(restoredAnswers);
        setTimeSpentByQuestionId(restoredTimeSpent);
        setCurrentIndex(Math.min(Math.max(draft.currentIndex, 0), Math.max(questions.length - 1, 0)));
        setElapsedSeconds(draft.elapsedSeconds);
        setHasPendingSubmit(Boolean(draft.pendingSubmit));
      }

      setIsDraftReady(true);
    }

    void restoreDraft();

    return () => {
      cancelled = true;
    };
  }, [initialSession.id, isResultMode, questions]);

  useEffect(() => {
    if (!isDraftReady || isResultMode) {
      return;
    }

    const saveTimer = window.setTimeout(() => {
      void savePracticeDraft({
        sessionId: initialSession.id,
        currentIndex,
        answers,
        elapsedSeconds,
        timeSpentByQuestionId,
        scratchByQuestionId,
        pendingSubmit: hasPendingSubmit
          ? {
              elapsedSeconds,
              answers: questions.map((item) => ({
                questionId: item.id,
                answer: answers[item.id] ?? null,
                timeSpentSeconds: timeSpentByQuestionId[item.id] ?? 0,
              })),
              savedAt: new Date().toISOString(),
            }
          : null,
      });
    }, 400);

    return () => window.clearTimeout(saveTimer);
  }, [
    answers,
    currentIndex,
    elapsedSeconds,
    hasPendingSubmit,
    initialSession.id,
    isDraftReady,
    isResultMode,
    questions,
    scratchByQuestionId,
    timeSpentByQuestionId,
  ]);

  function buildSubmitDraft(): PracticeSubmitDraft {
    return {
      elapsedSeconds,
      answers: questions.map((item) => ({
        questionId: item.id,
        answer: answers[item.id] ?? null,
        timeSpentSeconds: timeSpentByQuestionId[item.id] ?? 0,
      })),
      savedAt: new Date().toISOString(),
    };
  }

  async function savePendingSubmitDraft() {
    await savePracticeDraft({
      sessionId: initialSession.id,
      currentIndex,
      answers,
      elapsedSeconds,
      timeSpentByQuestionId,
      scratchByQuestionId,
      pendingSubmit: buildSubmitDraft(),
    });
    setHasPendingSubmit(true);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 pb-36 md:px-6 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:pb-28">
      {!isResultMode && (!isOnline || hasPendingSubmit) ? (
        <div className="lg:col-span-2">
          <Alert variant={!isOnline ? "warning" : "info"}>
            {!isOnline ? <WifiOff aria-hidden="true" /> : <Check aria-hidden="true" />}
            <AlertTitle>{!isOnline ? "网络不稳定" : "提交草稿已保留"}</AlertTitle>
            <AlertDescription>
              {!isOnline
                ? "当前答案会继续保存到本地，网络恢复后可再次提交。"
                : "上次提交没有完成，答案和提交草稿仍在本地，可直接重试提交。"}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {resultSummary ? (
        <div className="lg:col-span-2">
          <CoachDiagnosisCard sessionId={initialSession.id} />
        </div>
      ) : null}

      <section className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardContent className="relative flex flex-col gap-4 pt-1">
            {question.materialHtml ? (
              <div className="rounded-lg bg-muted p-3">
                {question.material?.title ? (
                  <div className="mb-2 text-sm font-medium">{question.material.title}</div>
                ) : null}
                <RichHtml html={question.materialHtml} className="text-sm text-muted-foreground" />
              </div>
            ) : null}

            <RichHtml html={question.titleHtml} className="text-base leading-7" />

            <div className="flex flex-col gap-3">
              {question.options.map((option) => {
                const state = optionState(option.value);
                const stateLabel = optionStateLabel(state);

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={isResultMode || isPracticePaused}
                    aria-pressed={state === "selected"}
                    className={cn(
                      "flex min-h-12 w-full items-start gap-3 rounded-lg border bg-card px-3 py-3 text-left text-sm transition-colors",
                      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      state === "selected" && "border-primary bg-primary text-primary-foreground",
                      state === "correct" && "border-success bg-success/10 text-success",
                      state === "wrong" && "border-destructive bg-destructive/10 text-destructive",
                      isResultMode && "disabled:opacity-100",
                      isPracticePaused && "opacity-40"
                    )}
                    onClick={() => updateAnswer(option.value)}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium">
                      {option.label}
                    </span>
                    <RichHtml html={option.contentHtml} className="flex-1 leading-6" />
                    {stateLabel ? (
                      <span className="shrink-0 rounded-full border bg-background px-2 py-0.5 text-xs text-foreground">
                        {stateLabel}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {isResultMode ? (
              <Alert variant={isMemorizeMode ? "info" : currentResult?.isCorrect ? "success" : "warning"}>
                {isMemorizeMode ? (
                  <BookOpen aria-hidden="true" />
                ) : currentResult?.isCorrect ? (
                  <Check aria-hidden="true" />
                ) : (
                  <AlertTriangle aria-hidden="true" />
                )}
                <AlertTitle>
                  {isMemorizeMode ? "背题解析" : currentResult?.isCorrect ? "本题正确" : "本题未答对"}
                </AlertTitle>
                <AlertDescription>
                  <div className="flex flex-col gap-2">
                    <p>
                      正确答案：{currentResult?.correctAnswer || question.correctAnswer || "暂无"}
                      {isMemorizeMode ? "" : `；我的答案：${currentResult?.answer || "未作答"}`}
                    </p>
                    {currentResult?.analysisHtml || question.analysisHtml ? (
                      <RichHtml
                        html={currentResult?.analysisHtml ?? question.analysisHtml}
                        className="leading-6"
                      />
                    ) : (
                      <p>暂无解析。</p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}
            {isResultMode ? <TutorPanel questionId={question.id} sessionId={initialSession.id} /> : null}
            <DraftCanvas
              open={showDraftCanvas}
              value={currentScratch}
              readOnly={isResultMode}
              questionLabel={`第 ${currentIndex + 1} 题`}
              variant="overlay"
              onChange={updateCurrentScratch}
              onClose={() => setShowDraftCanvas(false)}
            />
            {isPracticePaused ? (
              <div className="absolute inset-0 grid place-items-center bg-card/90 p-6 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3 text-center">
                  <Badge variant="secondary">已暂停</Badge>
                  <Button type="button" onClick={togglePause}>
                    <Play data-icon="inline-start" />
                    继续答题
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:h-[calc(100dvh-6rem)] lg:min-h-0">
        {resultSummary ? (
          <Card size="sm">
            <CardContent className="flex flex-col gap-1">
              <div className="font-medium">
                {reviewMode ? "历史结果" : "提交结果"} · 正确率 {resultSummary.accuracy ?? "0.00"}%
              </div>
              <div className="text-sm text-muted-foreground">
                正确 {resultSummary.correctCount} / 错误 {resultSummary.wrongCount} / 未答{" "}
                {resultSummary.unansweredCount} · 用时 {formatSeconds(resultSummary.elapsedSeconds)}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            {answerSheetContent}
          </CardContent>
        </Card>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(15_23_42/0.08)] backdrop-blur lg:left-[var(--app-sidebar-width)] lg:p-3">
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="size-11 shrink-0 px-0 sm:w-auto sm:px-3"
            aria-label="上一题"
            disabled={currentIndex === 0}
            onClick={() => goToQuestion(currentIndex - 1)}
          >
            <ChevronLeft data-icon="inline-start" />
            <span className="hidden sm:inline">上一题</span>
          </Button>
          <div className="min-w-0 flex-1 text-center text-xs sm:text-sm">
            <div className="truncate font-medium">{actionBarPrimaryText}</div>
            <div className="truncate text-muted-foreground">{actionBarSecondaryText}</div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="size-11 shrink-0 px-0 sm:w-auto sm:px-3"
            aria-label="下一题"
            disabled={currentIndex === questions.length - 1}
            onClick={() => goToQuestion(currentIndex + 1)}
          >
            <span className="hidden sm:inline">下一题</span>
            <ChevronRight data-icon="inline-end" />
          </Button>
          <div className="hidden h-8 w-px shrink-0 bg-border md:block" />
          {!isResultMode ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="size-11 shrink-0 px-0 md:w-auto md:px-3"
              aria-label={isPracticePaused ? "继续答题" : "暂停答题"}
              onClick={togglePause}
            >
              {isPracticePaused ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}
              <span className="hidden md:inline">{isPracticePaused ? "继续" : "暂停"}</span>
            </Button>
          ) : null}
          {!isResultMode || currentScratch ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="size-11 shrink-0 px-0 md:w-auto md:px-3"
              aria-label={isResultMode ? "查看草稿" : "草稿"}
              onClick={() => setShowDraftCanvas(true)}
            >
              <PencilLine data-icon="inline-start" />
              <span className="hidden md:inline">{isResultMode ? "草稿回看" : "草稿"}</span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="size-11 shrink-0 px-0 lg:hidden"
            aria-label="答题卡"
            onClick={() => setShowAnswerSheet(true)}
          >
            <Grid3X3 data-icon="inline-start" />
          </Button>
          {!isResultMode ? (
            <Button
              type="button"
              size="sm"
              className="size-11 shrink-0 px-0 sm:w-auto sm:px-3"
              aria-label="提交"
              onClick={() => setShowSubmitDialog(true)}
            >
              <Send data-icon="inline-start" />
              <span className="hidden sm:inline">提交</span>
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog open={showAnswerSheet} onOpenChange={(open) => setShowAnswerSheet(open)}>
        <DialogContent variant="sheet" className="p-4 lg:hidden">
          <DialogTitle className="sr-only">答题卡</DialogTitle>
          <DialogDescription className="sr-only">
            查看本次练习的答题进度，并跳转到指定题目。
          </DialogDescription>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
          <div className="flex max-h-[calc(82vh-2rem)] flex-col gap-3 overflow-hidden">
            {answerSheetContent}
            <DialogClose className="w-full border-border bg-card text-sm font-medium hover:bg-secondary hover:text-secondary-foreground">
              收起答题卡
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSubmitDialog} onOpenChange={(open) => setShowSubmitDialog(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{completionRate < 0.5 ? "完成率不足 50%" : "确认提交练习"}</DialogTitle>
            <DialogDescription>
              已答 {answeredCount} / {questions.length} 题，提交后选项不可再修改。
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {completionRate < 0.5 ? (
              <Alert variant="warning">
                <AlertTriangle aria-hidden="true" />
                <AlertTitle>作答数量较少</AlertTitle>
                <AlertDescription>当前完成率较低，建议继续作答后再提交。</AlertDescription>
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isOnline
                  ? "系统会计算正确、错误、未答和正确率，并显示答案解析。"
                  : "当前处于离线状态，提交草稿会保存在本地，网络恢复后可重试。"}
              </p>
            )}
            {submitError ? <p className="mt-3 text-sm text-destructive">{submitError}</p> : null}
          </DialogBody>
          <DialogFooter>
            <DialogClose
              className="border-border bg-card px-3 text-sm font-medium hover:bg-secondary hover:text-secondary-foreground"
              disabled={isSubmitting}
            >
              取消
            </DialogClose>
            <Button type="button" disabled={isSubmitting} onClick={submitPractice}>
              {isSubmitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
              {isOnline ? "确认提交" : "保存提交草稿"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
