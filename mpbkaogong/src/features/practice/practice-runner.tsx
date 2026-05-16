"use client";

import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  PencilLine,
  Send,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DraftCanvas } from "@/components/practice/draft-canvas";
import { RichHtml } from "@/components/question/rich-html";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  clearPracticeDraft,
  getPracticeDraft,
  savePracticeDraft,
  type PracticeSubmitDraft,
} from "@/lib/offline/practice-drafts";
import { cn } from "@/lib/utils";

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
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [hasPendingSubmit, setHasPendingSubmit] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof window === "undefined" ? true : window.navigator.onLine
  );

  const questions = initialSession.questions;
  const question = questions[currentIndex];
  const isMemorizeMode = initialSession.mode === "MEMORIZE";
  const answeredCount = Object.values(answers).filter((answer) => normalizeAnswer(answer).length > 0).length;
  const completionRate = questions.length > 0 ? answeredCount / questions.length : 0;
  const isResultMode = initialSession.status === "SUBMITTED" || isMemorizeMode || Boolean(submitResult);
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
  const currentResult = resultByQuestionId.get(question.id);

  useEffect(() => {
    if (isResultMode) {
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
  }, [isResultMode, question.id]);

  function updateAnswer(value: string) {
    if (isResultMode) {
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

  function goToQuestion(index: number) {
    setShowDraftCanvas(false);
    setCurrentIndex(Math.min(Math.max(index, 0), Math.max(questions.length - 1, 0)));
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
      await clearPracticeDraft(initialSession.id);
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
      if (isResultMode) {
        setIsDraftReady(true);
        return;
      }

      const draft = await getPracticeDraft(initialSession.id);

      if (cancelled) {
        return;
      }

      if (draft) {
        const questionIds = new Set(questions.map((item) => item.id));
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
        setLastSavedAt(draft.updatedAt);
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
      }).then(() => setLastSavedAt(new Date().toISOString()));
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
      pendingSubmit: buildSubmitDraft(),
    });
    setHasPendingSubmit(true);
    setLastSavedAt(new Date().toISOString());
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 pb-32 md:px-6 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:pb-8">
      {!isResultMode && (!isOnline || hasPendingSubmit || lastSavedAt) ? (
        <div className="lg:col-span-2">
          <Alert>
            {!isOnline ? <WifiOff aria-hidden="true" /> : <Check aria-hidden="true" />}
            <AlertTitle>{!isOnline ? "网络不稳定" : hasPendingSubmit ? "提交草稿已保留" : "本地进度已保存"}</AlertTitle>
            <AlertDescription>
              {!isOnline
                ? "当前答案会继续保存到本地，网络恢复后可再次提交。"
                : hasPendingSubmit
                  ? "上次提交没有完成，答案和提交草稿仍在本地，可直接重试提交。"
                  : `刷新页面后会恢复到当前进度${lastSavedAt ? `，最近保存 ${new Date(lastSavedAt).toLocaleTimeString("zh-CN")}` : ""}。`}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <section className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>{initialSession.title}</CardTitle>
                <CardDescription>
                  第 {currentIndex + 1} / {questions.length} 题
                  {question.sectionName ? ` · ${question.sectionName}` : ""}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={isResultMode ? "secondary" : "outline"}>
                  {reviewMode ? "历史回看" : isMemorizeMode ? "背题模式" : isResultMode ? "结果态" : "答题中"}
                </Badge>
                <Badge variant="outline">{formatSeconds(elapsedSeconds)}</Badge>
                {!isResultMode ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowDraftCanvas(true)}>
                    <PencilLine data-icon="inline-start" />
                    草稿
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
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

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={isResultMode}
                    className={cn(
                      "flex min-h-12 w-full items-start gap-3 rounded-lg border bg-card px-3 py-3 text-left text-sm transition-colors",
                      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      state === "selected" && "border-primary bg-primary text-primary-foreground",
                      state === "correct" && "border-primary bg-secondary",
                      state === "wrong" && "border-destructive bg-destructive/10 text-destructive",
                      isResultMode && "disabled:opacity-100"
                    )}
                    onClick={() => updateAnswer(option.value)}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium">
                      {option.label}
                    </span>
                    <RichHtml html={option.contentHtml} className="flex-1 leading-6" />
                  </button>
                );
              })}
            </div>

            {isResultMode ? (
              <Alert>
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
          </CardContent>
          <CardFooter className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={currentIndex === 0}
              onClick={() => goToQuestion(currentIndex - 1)}
            >
              <ChevronLeft data-icon="inline-start" />
              上一题
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={currentIndex === questions.length - 1}
              onClick={() => goToQuestion(currentIndex + 1)}
            >
              下一题
              <ChevronRight data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>
      </section>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
        {resultSummary ? (
          <Card>
            <CardHeader>
              <CardTitle>{reviewMode ? "历史结果" : "提交结果"}</CardTitle>
              <CardDescription>正确率 {resultSummary.accuracy ?? "0.00"}%</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-muted-foreground">正确</div>
                <div className="font-medium">{resultSummary.correctCount}</div>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-muted-foreground">错误</div>
                <div className="font-medium">{resultSummary.wrongCount}</div>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-muted-foreground">未答</div>
                <div className="font-medium">{resultSummary.unansweredCount}</div>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-muted-foreground">用时</div>
                <div className="font-medium">{formatSeconds(resultSummary.elapsedSeconds)}</div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>答题卡</CardTitle>
            <CardDescription>
              {isMemorizeMode ? `共 ${questions.length} 题` : `已答 ${answeredCount} / ${questions.length}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((item, index) => {
                const result = resultByQuestionId.get(item.id);
                const isAnswered = normalizeAnswer(isResultMode ? result?.answer : answers[item.id]).length > 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "grid size-10 place-items-center rounded-lg border text-sm font-medium",
                      index === currentIndex && "border-primary",
                      !isResultMode && isAnswered && "bg-primary text-primary-foreground",
                      isResultMode && result?.isCorrect === true && "bg-secondary",
                      isResultMode && result?.isCorrect === false && "bg-destructive/10 text-destructive"
                    )}
                    title={stripHtml(item.titleHtml)}
                    onClick={() => goToQuestion(index)}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </CardContent>
          {!isResultMode ? (
            <CardFooter className="flex flex-col gap-2">
              <Button type="button" className="w-full" onClick={() => setShowSubmitDialog(true)}>
                <Send data-icon="inline-start" />
                提交练习
              </Button>
              {submitError ? <p className="text-xs text-destructive">{submitError}</p> : null}
            </CardFooter>
          ) : null}
        </Card>
      </aside>

      {!isResultMode ? (
        <div className="fixed inset-x-0 bottom-16 border-t bg-background p-3 lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium">
                已答 {answeredCount} / {questions.length}
              </div>
              <div className="text-muted-foreground">{formatSeconds(elapsedSeconds)}</div>
            </div>
            <Button type="button" variant="outline" onClick={() => setShowDraftCanvas(true)}>
              <PencilLine data-icon="inline-start" />
              草稿
            </Button>
            <Button type="button" onClick={() => setShowSubmitDialog(true)}>
              <Send data-icon="inline-start" />
              提交
            </Button>
          </div>
        </div>
      ) : null}

      {showSubmitDialog ? (
        <div className="fixed inset-0 grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{completionRate < 0.5 ? "完成率不足 50%" : "确认提交练习"}</CardTitle>
              <CardDescription>
                已答 {answeredCount} / {questions.length} 题，提交后选项不可再修改。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {completionRate < 0.5 ? (
                <Alert>
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
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setShowSubmitDialog(false)}>
                取消
              </Button>
              <Button type="button" disabled={isSubmitting} onClick={submitPractice}>
                {isSubmitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
                {isOnline ? "确认提交" : "保存提交草稿"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : null}

      <DraftCanvas open={showDraftCanvas} onClose={() => setShowDraftCanvas(false)} />
    </main>
  );
}
