"use client";

import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  Check,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  LoaderCircle,
  MessageSquare,
  MoreHorizontal,
  Pause,
  PencilLine,
  Play,
  Send,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAppHeader } from "@/components/layout/app-header-context";
import { DraftCanvas } from "@/components/practice/draft-canvas";
import { RichHtml } from "@/components/question/rich-html";
import { ResponsiveDrawer, StickyActionBar } from "@/components/student/interaction-overlays";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  type PracticeEventDraft,
  type PracticeSubmitDraft,
} from "@/lib/offline/practice-drafts";
import { cleanLearningTitle } from "@/lib/display-title";
import { cn } from "@/lib/utils";
import { TutorPanel } from "@/features/agent/tutor-panel";
import { PracticeAnswerSheet } from "@/features/practice/practice-answer-sheet";
import {
  PracticeResultAnalysisPanel,
  PracticeResultOverview,
} from "@/features/practice/practice-result-panels";
import { PracticeResultWorkspace } from "@/features/practice/practice-result-workspace";
import { PracticeReflectionPanel } from "@/features/practice/practice-reflection-panel";
import {
  formatPracticeClock as formatSeconds,
  getInitialPracticeQuestionIndex,
  normalizePracticeAnswer as normalizeAnswer,
  optionStateLabel,
} from "@/features/practice/practice-view-utils";
import { usePracticeTimer } from "@/features/practice/use-practice-timer";
import { usePracticeEventLog } from "@/features/practice/use-practice-event-log";
import { usePracticeProgressSync } from "@/features/practice/use-practice-progress-sync";

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
  decisionNote?: string | null;
};

type PracticeSessionView = {
  id: string;
  title: string;
  mode: string;
  status: string;
  purpose: string;
  timingMode: string;
  totalCount: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  elapsedSeconds: number;
  timeLimitSeconds: number | null;
  deadlineAt: string | null;
  serverNow: string;
  updatedAt: string;
  pauseCount: number;
  pausedSeconds: number;
  score: string | null;
  maxScore: string | null;
  reflectionText?: string | null;
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
  pauseCount: number;
  pausedSeconds: number;
  score: string | null;
  maxScore: string | null;
  answers: Array<{
    questionId: string;
    answer: string | null;
    correctAnswer: string;
    isCorrect: boolean | null;
    timeSpentSeconds: number;
    decisionNote?: string | null;
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

export function PracticeRunner({
  initialSession,
  reviewMode = false,
}: {
  initialSession: PracticeSessionView;
  reviewMode?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    getInitialPracticeQuestionIndex(initialSession.status, initialSession.userAnswers)
  );
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
  const [decisionNotesByQuestionId, setDecisionNotesByQuestionId] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialSession.userAnswers
        .filter((answer) => answer.decisionNote)
        .map((answer) => [answer.questionId, answer.decisionNote ?? ""])
    )
  );
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showDraftCanvas, setShowDraftCanvas] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [hasPendingSubmit, setHasPendingSubmit] = useState(false);
  const [progressSyncError, setProgressSyncError] = useState<string | null>(null);
  const [scratchByQuestionId, setScratchByQuestionId] = useState<Record<string, PracticeScratchDraft>>({});
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [showTutor, setShowTutor] = useState(false);
  const [showDecisionNote, setShowDecisionNote] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof window === "undefined" ? true : window.navigator.onLine
  );
  const appHeader = useAppHeader();

  const questions = initialSession.questions;
  const question = questions[currentIndex];
  const isMemorizeMode = initialSession.mode === "MEMORIZE";
  const answeredCount = Object.values(answers).filter((answer) => normalizeAnswer(answer).length > 0).length;
  const completionRate = questions.length > 0 ? answeredCount / questions.length : 0;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const isResultMode = initialSession.status === "SUBMITTED" || isMemorizeMode || Boolean(submitResult);
  const { events, setEvents, record, recordVisit } = usePracticeEventLog(question.id);
  const timer = usePracticeTimer({
    initialElapsedSeconds: initialSession.elapsedSeconds,
    timeLimitSeconds: initialSession.timeLimitSeconds,
    deadlineAt: initialSession.deadlineAt,
    serverNow: initialSession.serverNow,
    timingMode: initialSession.timingMode,
    disabled: isResultMode || timeExpired,
    onActiveSecond: () => {
      setTimeSpentByQuestionId((current) => ({
        ...current,
        [question.id]: (current[question.id] ?? 0) + 1,
      }));
    },
    onExpire: (expiredElapsedSeconds) => {
      const expiryEvent: PracticeEventDraft = {
        type: "TIME_EXPIRED",
        questionId: question.id,
        occurredAt: new Date().toISOString(),
      };
      record({ type: "TIME_EXPIRED", questionId: question.id });
      setTimeExpired(true);
      void submitPractice(expiredElapsedSeconds, [...events, expiryEvent]);
    },
  });
  const {
    elapsedSeconds,
    setElapsedSeconds,
    pauseCount,
    setPauseCount,
    pausedSeconds,
    setPausedSeconds,
  } = timer;
  const isPracticePaused = !isResultMode && timer.isPaused;
  usePracticeProgressSync({
    sessionId: initialSession.id,
    enabled: isDraftReady && !isResultMode && !isSubmitting,
    isOnline,
    initialAnswers: initialSession.userAnswers,
    questionIds: questions.map((item) => item.id),
    answers,
    timeSpentByQuestionId,
    decisionNotesByQuestionId,
    elapsedSeconds,
    pauseCount,
    pausedSeconds,
    onError: setProgressSyncError,
  });
  const currentScratch = scratchByQuestionId[question.id] ?? null;
  const resultByQuestionId = useMemo(() => {
    const map = new Map<
      string,
      {
        answer: string | null;
        correctAnswer?: string;
        isCorrect: boolean | null;
        analysisHtml?: string | null;
        decisionNote?: string | null;
      }
    >();

    for (const answer of initialSession.userAnswers) {
      const matchedQuestion = questions.find((item) => item.id === answer.questionId);
      map.set(answer.questionId, {
        answer: answer.answer,
        correctAnswer: matchedQuestion?.correctAnswer,
        isCorrect: answer.isCorrect,
        analysisHtml: matchedQuestion?.analysisHtml,
        decisionNote: answer.decisionNote,
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

  function updateAnswer(value: string) {
    if (isResultMode || isPracticePaused || timeExpired) {
      return;
    }

    setAnswers((current) => {
      const previous = normalizeAnswer(current[question.id]);
      let nextAnswer = value;

      if (question.type === "MULTIPLE") {
        const nextValues = new Set(previous ? previous.split(",") : []);

        if (nextValues.has(value)) {
          nextValues.delete(value);
        } else {
          nextValues.add(value);
        }

        nextAnswer = Array.from(nextValues).sort().join(",");
      }
      if (previous && previous !== normalizeAnswer(nextAnswer)) {
        record({ questionId: question.id, type: "ANSWER_CHANGE" });
      }
      return {
        ...current,
        [question.id]: nextAnswer,
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
      decisionNotesByQuestionId,
      pauseCount,
      pausedSeconds,
      events,
      timeExpired,
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
    const targetIndex = Math.min(Math.max(index, 0), Math.max(questions.length - 1, 0));
    if (targetIndex === currentIndex) return;
    if (!normalizeAnswer(answers[question.id])) {
      record({ questionId: question.id, type: "SKIP" });
    }
    recordVisit(questions[targetIndex].id);
    void saveLocalPracticeDraft();
    setShowDraftCanvas(false);
    setShowAnswerSheet(false);
    setCurrentIndex(targetIndex);
  }

  function togglePause() {
    if (isResultMode || initialSession.timingMode === "STRICT") return;
    record({ questionId: question.id, type: isPracticePaused ? "RESUME" : "PAUSE" });
    timer.togglePause();
  }

  async function submitPractice(
    elapsedOverride?: number,
    eventsOverride?: PracticeEventDraft[]
  ) {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const submitDraft = buildSubmitDraft(elapsedOverride, eventsOverride);

      if (!isOnline) {
        await savePendingSubmitDraft(submitDraft);
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
      await savePendingSubmitDraft(buildSubmitDraft(elapsedOverride, eventsOverride));
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
          pauseCount: initialSession.pauseCount,
          pausedSeconds: initialSession.pausedSeconds,
          score: initialSession.score,
          maxScore: initialSession.maxScore,
        }
      : null;
  const nextAction = initialSession.purpose === "FOUNDATION"
    ? {
        href: "/question-bank/special",
        label: (resultSummary?.correctCount ?? 0) >= 9 ? "进入下一个叶子类型" : "再练本类型15题",
        description: (resultSummary?.correctCount ?? 0) >= 9 ? "本轮已达到9/15，筑基状态已更新。" : "本轮尚未达到9/15，继续训练当前类型。",
        icon: ArrowRight,
      }
    : resultSummary?.wrongCount
    ? { href: "/question-bank/wrong", label: "复盘本次错题", description: "答错的题已自动进入错题本。", icon: BookMarked }
    : initialSession.mode === "SPECIAL"
      ? { href: "/question-bank/special", label: "继续专项练习", description: "本组已完成，可以继续选择一个知识点。", icon: ArrowRight }
      : { href: "/", label: "返回今日训练", description: "本组已完成，回到首页选择下一步。", icon: ArrowRight };
  const NextActionIcon = nextAction.icon;

  function questionStatus(item: PracticeQuestion) {
    const result = resultByQuestionId.get(item.id);
    const isAnswered = normalizeAnswer(isResultMode ? result?.answer : answers[item.id]).length > 0;

    if (!isResultMode) {
      return isAnswered ? "answered" : "default";
    }

    if (result?.isCorrect === true) {
      return "correct";
    }

    if (isAnswered && result?.isCorrect === false) {
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
    <PracticeAnswerSheet
      groups={answerGroups}
      currentIndex={currentIndex}
      answeredCount={answeredCount}
      totalCount={questions.length}
      completionRate={completionRate}
      isMemorizeMode={isMemorizeMode}
      legend={answerLegend}
      getButtonClassName={answerButtonClassName}
      getQuestionStatus={questionStatus}
      onSelect={goToQuestion}
    />
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
      : timer.remainingSeconds === null
        ? formatSeconds(elapsedSeconds)
        : `剩余 ${formatSeconds(timer.remainingSeconds)}`;
  const headerSubtitle = `第 ${currentIndex + 1} / ${questions.length} 题${
    question.sectionName ? ` · ${question.sectionName}` : ""
  }`;

  useEffect(() => {
    appHeader?.setHeader({
      title: cleanLearningTitle(initialSession.title),
      subtitle: headerSubtitle,
      actions: isResultMode && resultSummary ? (
        <dl className="practice-result-topbar-summary hidden items-center divide-x divide-foreground/15 lg:flex">
          {resultSummary.maxScore ? (
            <div className="px-3 text-center">
              <dt className="text-[0.65rem] text-muted-foreground">得分</dt>
              <dd className="student-heading text-base font-semibold tabular-nums text-primary">{resultSummary.score ?? "0"}/{resultSummary.maxScore}</dd>
            </div>
          ) : null}
          <div className="px-3 text-center">
            <dt className="text-[0.65rem] text-muted-foreground">正确</dt>
            <dd className="student-heading text-base font-semibold tabular-nums text-success">{resultSummary.correctCount}</dd>
          </div>
          <div className="px-3 text-center">
            <dt className="text-[0.65rem] text-muted-foreground">错误</dt>
            <dd className="student-heading text-base font-semibold tabular-nums text-destructive">{resultSummary.wrongCount}</dd>
          </div>
          <div className="px-3 text-center">
            <dt className="text-[0.65rem] text-muted-foreground">未答</dt>
            <dd className="student-heading text-base font-semibold tabular-nums">{resultSummary.unansweredCount}</dd>
          </div>
          <div className="hidden px-3 text-center 2xl:block">
            <dt className="text-[0.65rem] text-muted-foreground">用时</dt>
            <dd className="student-heading text-base font-semibold tabular-nums">{formatSeconds(resultSummary.elapsedSeconds)}</dd>
          </div>
        </dl>
      ) : !isResultMode ? (
        <div className="practice-topbar-actions flex items-center gap-1.5">
          <span className="hidden border-r border-foreground/15 pr-3 text-xs font-medium tabular-nums text-muted-foreground lg:inline">
            {currentIndex + 1} / {questions.length}
          </span>
          <span className="hidden items-center gap-1.5 border-r border-foreground/15 pr-3 text-xs text-muted-foreground xl:inline-flex">
            <Clock3 className="size-3.5" aria-hidden="true" />
            <span className="font-mono font-medium tabular-nums text-foreground">{actionBarSecondaryText}</span>
          </span>
          <Button type="button" variant="ghost" size="sm" className="hidden h-8 lg:inline-flex" disabled={currentIndex === 0 || isPracticePaused} onClick={() => goToQuestion(currentIndex - 1)}>
            <ChevronLeft data-icon="inline-start" />上一题
          </Button>
          <Button type="button" variant="ghost" size="sm" className="hidden h-8 lg:inline-flex" disabled={currentIndex === questions.length - 1 || isPracticePaused} onClick={() => goToQuestion(currentIndex + 1)}>
            下一题<ChevronRight data-icon="inline-end" />
          </Button>
          {initialSession.timingMode !== "STRICT" ? (
            <Button type="button" variant="ghost" size="sm" className="hidden h-8 xl:inline-flex" onClick={togglePause}>
              {isPracticePaused ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}
              {isPracticePaused ? "继续" : "暂停"}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" className="hidden h-8 xl:inline-flex" onClick={() => setShowDraftCanvas(true)}>
            <PencilLine data-icon="inline-start" />草稿
          </Button>
        </div>
      ) : undefined,
    });

    return () => appHeader?.setHeader(null);
  }, [
    actionBarSecondaryText,
    appHeader,
    currentIndex,
    headerSubtitle,
    initialSession.title,
    initialSession.timingMode,
    isPracticePaused,
    isResultMode,
    questions.length,
  ]);

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

        if (new Date(draft.updatedAt).getTime() > new Date(initialSession.updatedAt).getTime()) {
          setAnswers(restoredAnswers);
          setTimeSpentByQuestionId(restoredTimeSpent);
          setDecisionNotesByQuestionId(
            Object.fromEntries(
              Object.entries(draft.decisionNotesByQuestionId ?? {}).filter(([questionId]) => questionIds.has(questionId))
            )
          );
          setPauseCount(draft.pauseCount ?? 0);
          setPausedSeconds(draft.pausedSeconds ?? 0);
          setEvents(draft.events ?? []);
          setTimeExpired(Boolean(draft.timeExpired));
          setCurrentIndex(Math.min(Math.max(draft.currentIndex, 0), Math.max(questions.length - 1, 0)));
          setElapsedSeconds(draft.elapsedSeconds);
          setHasPendingSubmit(Boolean(draft.pendingSubmit));
        }
      }

      setIsDraftReady(true);
    }

    void restoreDraft();

    return () => {
      cancelled = true;
    };
  }, [initialSession.id, initialSession.updatedAt, isResultMode, questions, setElapsedSeconds, setEvents, setPauseCount, setPausedSeconds]);

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
        decisionNotesByQuestionId,
        pauseCount,
        pausedSeconds,
        events,
        timeExpired,
        scratchByQuestionId,
        pendingSubmit: hasPendingSubmit
          ? {
              elapsedSeconds,
              pauseCount,
              pausedSeconds,
              answers: questions.map((item) => ({
                questionId: item.id,
                answer: answers[item.id] ?? null,
                timeSpentSeconds: timeSpentByQuestionId[item.id] ?? 0,
                decisionNote: decisionNotesByQuestionId[item.id] ?? null,
              })),
              events,
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
    decisionNotesByQuestionId,
    pauseCount,
    pausedSeconds,
    events,
    timeExpired,
  ]);

  function buildSubmitDraft(
    elapsedOverride = elapsedSeconds,
    eventsOverride = events
  ): PracticeSubmitDraft {
    return {
      elapsedSeconds: elapsedOverride,
      pauseCount,
      pausedSeconds,
      answers: questions.map((item) => ({
        questionId: item.id,
        answer: answers[item.id] ?? null,
        timeSpentSeconds: timeSpentByQuestionId[item.id] ?? 0,
        decisionNote: decisionNotesByQuestionId[item.id] ?? null,
      })),
      events: eventsOverride,
      savedAt: new Date().toISOString(),
    };
  }

  async function savePendingSubmitDraft(submitDraft = buildSubmitDraft()) {
    await savePracticeDraft({
      sessionId: initialSession.id,
      currentIndex,
      answers,
      elapsedSeconds,
      timeSpentByQuestionId,
      decisionNotesByQuestionId,
      pauseCount,
      pausedSeconds,
      events,
      timeExpired,
      scratchByQuestionId,
      pendingSubmit: submitDraft,
    });
    setHasPendingSubmit(true);
  }

  if (isResultMode && resultSummary) {
    const questionPane = (
      <section className="practice-review-question flex min-h-full flex-col p-4 lg:p-5">
        <div className="flex items-center justify-between gap-3 border-b border-foreground/20 pb-3">
          <Button type="button" variant="outline" size="sm" disabled={currentIndex === 0} onClick={() => goToQuestion(currentIndex - 1)}>
            <ChevronLeft data-icon="inline-start" />上一题
          </Button>
          <span className="student-heading font-semibold">第 {currentIndex + 1} 题</span>
          <Button type="button" variant="outline" size="sm" disabled={currentIndex === questions.length - 1} onClick={() => goToQuestion(currentIndex + 1)}>
            下一题<ChevronRight data-icon="inline-end" />
          </Button>
        </div>

        {question.materialHtml ? (
          <div className="mt-4 border-l-2 border-accent bg-muted/45 p-3">
            {question.material?.title ? <div className="mb-2 text-sm font-medium">{question.material.title}</div> : null}
            <RichHtml html={question.materialHtml} className="text-sm leading-7 text-muted-foreground" />
          </div>
        ) : null}

        <RichHtml html={question.titleHtml} className="mt-5 text-base leading-8" />
        <div className="mt-5 flex flex-col gap-2.5">
          {question.options.map((option) => {
            const state = optionState(option.value);
            const stateLabel = optionStateLabel(state);
            return (
              <button
                key={option.id}
                type="button"
                disabled
                className={cn(
                  "flex min-h-13 w-full items-start gap-3 border bg-card/50 px-3.5 py-3 text-left text-sm disabled:opacity-100",
                  state === "correct" && "border-success bg-success/8 text-success",
                  state === "wrong" && "border-destructive bg-destructive/8 text-destructive"
                )}
              >
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold", state === "correct" && "border-success bg-success text-success-foreground", state === "wrong" && "border-destructive bg-destructive text-white")}>
                  {option.label}
                </span>
                <RichHtml html={option.contentHtml} className="min-w-0 flex-1 leading-6" />
                {stateLabel ? <span className="shrink-0 border border-current/25 px-2 py-0.5 text-xs">{stateLabel}</span> : null}
              </button>
            );
          })}
        </div>
        {currentResult?.decisionNote ? (
          <blockquote className="mt-4 border-l-2 border-primary bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
            当时记录：{currentResult.decisionNote}
          </blockquote>
        ) : null}
        <div className="mt-auto flex items-center justify-between border-t border-foreground/20 pt-4 text-sm text-muted-foreground">
          <span className="text-xs tracking-[0.12em]">题目卷面 · 结果回看</span>
          <button type="button" className="inline-flex items-center gap-2" onClick={() => setShowDraftCanvas(true)}><PencilLine className="size-4" />草稿回看</button>
        </div>
        <DraftCanvas
          open={showDraftCanvas}
          value={currentScratch}
          readOnly
          questionLabel={`第 ${currentIndex + 1} 题`}
          variant="overlay"
          onChange={updateCurrentScratch}
          onClose={() => setShowDraftCanvas(false)}
        />
      </section>
    );

    return (
      <PracticeResultWorkspace
        summary={resultSummary}
        reviewMode={reviewMode}
        currentIndex={currentIndex}
        totalCount={questions.length}
        questionPane={questionPane}
        analysisPane={
          <div className="flex min-h-full flex-col">
            <PracticeResultAnalysisPanel
              isMemorizeMode={isMemorizeMode}
              isCorrect={currentResult?.isCorrect}
              answer={currentResult?.answer}
              correctAnswer={currentResult?.correctAnswer || question.correctAnswer || "暂无"}
              analysisHtml={currentResult?.analysisHtml ?? question.analysisHtml}
              className="flex-1 border-0 shadow-none"
            />
            <div className="border-t border-foreground/20 bg-card/55 p-4">
              <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground">下一步</div>
              <p className="mt-2 text-sm text-muted-foreground">{nextAction.description}</p>
              <Link href={nextAction.href} className={cn(buttonVariants(), "mt-3 w-full")}>
                <NextActionIcon data-icon="inline-start" />
                {nextAction.label}
              </Link>
            </div>
            {["BASELINE", "MOCK", "TIME_PRESSURE"].includes(initialSession.purpose) ? (
              <PracticeReflectionPanel
                sessionId={initialSession.id}
                initialText={initialSession.reflectionText}
              />
            ) : null}
          </div>
        }
        answerSheet={answerSheetContent}
        tutorPane={
          <TutorPanel
            questionId={question.id}
            sessionId={initialSession.id}
            variant="dock"
            heightMode="fill"
            className="h-full min-h-0 rounded-none border-0 shadow-none"
            contextLabel={`第 ${currentIndex + 1} 题；我的答案：${currentResult?.answer || "未作答"}；正确答案：${currentResult?.correctAnswer || question.correctAnswer || "暂无"}`}
          />
        }
      />
    );
  }

  return (
    <main
      className={cn(
        "practice-workspace mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 pb-36 md:px-6 lg:grid lg:items-start lg:pb-8",
        isResultMode
          ? "lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]"
          : "lg:grid-cols-[minmax(0,1fr)_320px]"
      )}
    >
      {!isResultMode && (!isOnline || hasPendingSubmit || progressSyncError) ? (
        <div className="lg:col-span-2">
          <Alert variant={!isOnline ? "warning" : "info"}>
            {!isOnline ? <WifiOff aria-hidden="true" /> : <Check aria-hidden="true" />}
            <AlertTitle>
              {!isOnline ? "网络不稳定" : hasPendingSubmit ? "提交草稿已保留" : "进度同步失败"}
            </AlertTitle>
            <AlertDescription>
              {!isOnline
                ? "当前答案会继续保存到本地，网络恢复后可再次提交。"
                : hasPendingSubmit
                  ? "上次提交没有完成，答案和提交草稿仍在本地，可直接重试提交。"
                  : progressSyncError}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div
        className={cn(
          "flex min-w-0 flex-col gap-4",
          isResultMode
            ? "lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-start"
            : "lg:contents"
        )}
      >
        {resultSummary ? (
          <PracticeResultOverview
            summary={resultSummary}
            reviewMode={reviewMode}
            className="lg:col-span-2"
          />
        ) : null}

        <section className="flex min-w-0 flex-col gap-4">
          <Card className="practice-question-paper">
            <CardContent className="relative flex flex-col gap-4 pt-1">
            {!isResultMode ? (
              <div className="flex min-h-11 items-center justify-between gap-3 border-b border-foreground/20 pb-3">
                <div className="min-w-0">
                  <div className="student-heading text-sm font-semibold">
                    第 {currentIndex + 1} / {questions.length} 题
                  </div>
                  {question.sectionName ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{question.sectionName}</div> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn("text-xs", isOnline ? "text-success" : "text-warning")}>
                    {isOnline ? "已自动保存" : "已保存到本机"}
                  </span>
                  <Button type="button" variant="ghost" size="sm" className="hidden h-8 lg:inline-flex" onClick={() => setShowDecisionNote(true)}>
                    <PencilLine data-icon="inline-start" />记录想法
                  </Button>
                </div>
              </div>
            ) : null}
            {isResultMode ? (
              <div className="hidden items-center justify-between gap-3 border-b border-dashed pb-3 lg:flex">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === 0}
                  onClick={() => goToQuestion(currentIndex - 1)}
                >
                  <ChevronLeft data-icon="inline-start" />
                  上一题
                </Button>
                <div className="student-heading text-sm font-semibold">第 {currentIndex + 1} 题</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === questions.length - 1}
                  onClick={() => goToQuestion(currentIndex + 1)}
                >
                  下一题
                  <ChevronRight data-icon="inline-end" />
                </Button>
              </div>
            ) : null}
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
                    disabled={isResultMode || isPracticePaused || timeExpired}
                    aria-pressed={state === "selected"}
                    className={cn(
                      "flex min-h-12 w-full items-start gap-3 rounded-lg border bg-card px-3 py-3 text-left text-sm transition-colors",
                      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      state === "selected" && "border-primary bg-primary/10 text-foreground shadow-[inset_3px_0_0_var(--primary)]",
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

            {!isResultMode ? (
              <div className="flex items-center justify-between gap-3 border-t border-foreground/20 pt-4 lg:hidden">
                <Button
                  type="button"
                  variant="outline"
                  disabled={currentIndex === 0}
                  onClick={() => goToQuestion(currentIndex - 1)}
                >
                  <ChevronLeft data-icon="inline-start" />上一题
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={currentIndex === questions.length - 1}
                  onClick={() => goToQuestion(currentIndex + 1)}
                >
                  下一题<ChevronRight data-icon="inline-end" />
                </Button>
              </div>
            ) : null}

            {isResultMode ? (
              <PracticeResultAnalysisPanel
                isMemorizeMode={isMemorizeMode}
                isCorrect={currentResult?.isCorrect}
                answer={currentResult?.answer}
                correctAnswer={currentResult?.correctAnswer || question.correctAnswer || "暂无"}
                analysisHtml={currentResult?.analysisHtml ?? question.analysisHtml}
                className="border-0 shadow-none lg:hidden"
              />
            ) : null}
            {isResultMode ? (
              <TutorPanel
                questionId={question.id}
                sessionId={initialSession.id}
                triggerLabel={currentResult?.isCorrect ? "复盘讲解" : "问助教"}
                contextLabel={`我的答案：${currentResult?.answer || "未作答"}；正确答案：${currentResult?.correctAnswer || question.correctAnswer || "暂无"}`}
                className="lg:hidden"
              />
            ) : null}
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

        {isResultMode ? (
          <PracticeResultAnalysisPanel
            isMemorizeMode={isMemorizeMode}
            isCorrect={currentResult?.isCorrect}
            answer={currentResult?.answer}
            correctAnswer={currentResult?.correctAnswer || question.correctAnswer || "暂无"}
            analysisHtml={currentResult?.analysisHtml ?? question.analysisHtml}
            className="hidden lg:flex"
          />
        ) : null}

      </div>

      <aside
        className={cn(
          "flex flex-col gap-4 lg:sticky lg:top-20 lg:h-[calc(100dvh-6rem)] lg:min-h-0",
          isPracticePaused && "pointer-events-none opacity-40"
        )}
      >
        {isResultMode ? (
          <Button type="button" variant="outline" className="hidden lg:flex" onClick={() => setShowTutor(true)}>
            <MessageSquare data-icon="inline-start" />围绕本题问助教
          </Button>
        ) : null}
        <Card
          className={cn(
            "practice-answer-sheet-panel hidden lg:flex lg:min-h-0 lg:flex-col",
            isResultMode ? "lg:max-h-[21rem] lg:flex-none" : "lg:flex-1"
          )}
        >
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            {answerSheetContent}
          </CardContent>
          {!isResultMode ? (
            <div className="shrink-0 border-t bg-card/70 p-3">
              <Button type="button" className="w-full" onClick={() => setShowSubmitDialog(true)}>
                <Send data-icon="inline-start" />提交练习
              </Button>
            </div>
          ) : null}
        </Card>

      </aside>

      {isResultMode ? (
        <ResponsiveDrawer open={showTutor} onOpenChange={setShowTutor} title="讲题助教" description="围绕当前题目的思路、错因和知识点继续追问。">
          <TutorPanel
            questionId={question.id}
            sessionId={initialSession.id}
            variant="dock"
            heightMode="fill"
            className="h-full min-h-[32rem] rounded-none border-0 shadow-none"
            contextLabel={`我的答案：${currentResult?.answer || "未作答"}；正确答案：${currentResult?.correctAnswer || question.correctAnswer || "暂无"}`}
          />
        </ResponsiveDrawer>
      ) : null}

      <StickyActionBar className="fixed inset-x-0 z-30 block min-h-0 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto grid max-w-3xl gap-2">
          <div className="flex min-w-0 items-center justify-between gap-3 px-1 text-xs sm:text-sm">
            <div className="truncate font-medium">{actionBarPrimaryText}</div>
            <div className="shrink-0 text-muted-foreground">{actionBarSecondaryText}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="size-11 shrink-0 px-0"
              aria-label="上一题"
              disabled={currentIndex === 0 || isPracticePaused}
              onClick={() => goToQuestion(currentIndex - 1)}
            >
              <ChevronLeft data-icon="inline-start" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="size-11 shrink-0 px-0"
              aria-label="下一题"
              disabled={currentIndex === questions.length - 1 || isPracticePaused}
              onClick={() => goToQuestion(currentIndex + 1)}
            >
              <ChevronRight data-icon="inline-end" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="size-11 shrink-0 px-0"
              aria-label="答题卡"
              disabled={isPracticePaused}
              onClick={() => setShowAnswerSheet(true)}
            >
              <Grid3X3 data-icon="inline-start" />
            </Button>
            {!isResultMode || currentScratch ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="size-11 shrink-0 px-0"
                aria-label="更多练习工具"
                onClick={() => setShowTools(true)}
              >
                <MoreHorizontal data-icon="inline-start" />
              </Button>
            ) : null}
            {!isResultMode ? (
              <Button
                type="button"
                size="sm"
                className="min-w-20 flex-1 px-3"
                disabled={isPracticePaused}
                onClick={() => setShowSubmitDialog(true)}
              >
                <Send data-icon="inline-start" />
                提交
              </Button>
            ) : (
              <Button type="button" size="sm" className="min-w-20 flex-1 px-3" onClick={() => setShowTutor(true)}>
                <MessageSquare data-icon="inline-start" />问助教
              </Button>
            )}
          </div>
        </div>
      </StickyActionBar>

      <Dialog open={showDecisionNote} onOpenChange={setShowDecisionNote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>记录本题想法</DialogTitle>
            <DialogDescription>这条记录会和答案、用时一起保存在本次练习草稿中。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Textarea
              className="min-h-32"
              maxLength={500}
              disabled={isPracticePaused || timeExpired}
              value={decisionNotesByQuestionId[question.id] ?? ""}
              placeholder="例如：先排除明显不符合条件的选项。"
              onChange={(event) => setDecisionNotesByQuestionId((current) => ({
                ...current,
                [question.id]: event.target.value,
              }))}
            />
          </DialogBody>
          <DialogFooter>
            <DialogClose className="border-border bg-card px-3 text-sm font-medium hover:bg-secondary hover:text-secondary-foreground">
              完成
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTools} onOpenChange={setShowTools}>
        <DialogContent variant="sheet" className="p-4 lg:hidden">
          <DialogHeader>
            <DialogTitle>练习工具</DialogTitle>
            <DialogDescription>草稿和暂停不会改变当前答案。</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-2">
            {!isResultMode && initialSession.timingMode !== "STRICT" ? (
              <Button type="button" variant="outline" className="justify-start" onClick={() => { setShowTools(false); togglePause(); }}>
                {isPracticePaused ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}
                {isPracticePaused ? "继续答题" : "暂停答题"}
              </Button>
            ) : null}
            {!isResultMode || currentScratch ? (
              <Button type="button" variant="outline" className="justify-start" onClick={() => { setShowTools(false); setShowDraftCanvas(true); }}>
                <PencilLine data-icon="inline-start" />{isResultMode ? "查看草稿" : "打开草稿"}
              </Button>
            ) : null}
            {!isResultMode ? (
              <Button type="button" variant="outline" className="justify-start" onClick={() => { setShowTools(false); setShowDecisionNote(true); }}>
                <PencilLine data-icon="inline-start" />记录本题想法
              </Button>
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>

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
            <DialogTitle>{unansweredCount > 0 ? `还有 ${unansweredCount} 题未作答` : "确认提交练习"}</DialogTitle>
            <DialogDescription>
              已答 {answeredCount} / {questions.length} 题，提交后选项不可再修改。
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {unansweredCount > 0 ? (
              <Alert variant="warning">
                <AlertTriangle aria-hidden="true" />
                <AlertTitle>未答题会按当前状态提交</AlertTitle>
                <AlertDescription>返回继续作答可通过答题卡快速定位未答题。</AlertDescription>
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
              返回继续作答
            </DialogClose>
            <Button type="button" disabled={isSubmitting} onClick={() => void submitPractice()}>
              {isSubmitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
              {isOnline ? (unansweredCount > 0 ? "仍然提交" : "提交并查看结果") : "保存提交草稿"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
