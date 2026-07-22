"use client";

import { useEffect, useRef } from "react";

type SavedAnswer = {
  questionId: string;
  answer: string | null;
  timeSpentSeconds: number;
  decisionNote?: string | null;
};

type ProgressSnapshot = {
  elapsedSeconds: number;
  pauseCount: number;
  pausedSeconds: number;
  answers: SavedAnswer[];
};

function answerSignature(answer: SavedAnswer) {
  return JSON.stringify([
    answer.answer ?? null,
    answer.timeSpentSeconds,
    answer.decisionNote?.trim() || null,
  ]);
}

export function usePracticeProgressSync({
  sessionId,
  enabled,
  isOnline,
  initialAnswers,
  questionIds,
  answers,
  timeSpentByQuestionId,
  decisionNotesByQuestionId,
  elapsedSeconds,
  pauseCount,
  pausedSeconds,
  onError,
}: {
  sessionId: string;
  enabled: boolean;
  isOnline: boolean;
  initialAnswers: SavedAnswer[];
  questionIds: string[];
  answers: Record<string, string>;
  timeSpentByQuestionId: Record<string, number>;
  decisionNotesByQuestionId: Record<string, string>;
  elapsedSeconds: number;
  pauseCount: number;
  pausedSeconds: number;
  onError: (message: string | null) => void;
}) {
  const latestRef = useRef<ProgressSnapshot | null>(null);
  const savedAnswersRef = useRef(
    new Map(initialAnswers.map((answer) => [answer.questionId, answerSignature(answer)]))
  );
  const savedTimingRef = useRef({
    elapsedSeconds,
    pauseCount,
    pausedSeconds,
  });

  useEffect(() => {
    latestRef.current = {
      elapsedSeconds,
      pauseCount,
      pausedSeconds,
      answers: questionIds.map((questionId) => ({
        questionId,
        answer: answers[questionId] ?? null,
        timeSpentSeconds: timeSpentByQuestionId[questionId] ?? 0,
        decisionNote: decisionNotesByQuestionId[questionId] ?? null,
      })),
    };
  }, [
    answers,
    decisionNotesByQuestionId,
    elapsedSeconds,
    pauseCount,
    pausedSeconds,
    questionIds,
    timeSpentByQuestionId,
  ]);

  useEffect(() => {
    if (!enabled || !isOnline) return;

    let cancelled = false;

    async function syncProgress(keepalive = false) {
      const snapshot = latestRef.current;
      if (!snapshot) return;

      const changedAnswers = snapshot.answers.filter(
        (answer) => savedAnswersRef.current.get(answer.questionId) !== answerSignature(answer)
      );
      const savedTiming = savedTimingRef.current;
      const timingChanged =
        snapshot.elapsedSeconds !== savedTiming.elapsedSeconds ||
        snapshot.pauseCount !== savedTiming.pauseCount ||
        snapshot.pausedSeconds !== savedTiming.pausedSeconds;

      if (changedAnswers.length === 0 && !timingChanged) return;

      try {
        const response = await fetch(`/api/practice/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            elapsedSeconds: snapshot.elapsedSeconds,
            pauseCount: snapshot.pauseCount,
            pausedSeconds: snapshot.pausedSeconds,
            answers: changedAnswers,
          }),
          keepalive,
        });

        if (!response.ok) throw new Error("progress sync failed");

        for (const answer of changedAnswers) {
          savedAnswersRef.current.set(answer.questionId, answerSignature(answer));
        }
        savedTimingRef.current = {
          elapsedSeconds: snapshot.elapsedSeconds,
          pauseCount: snapshot.pauseCount,
          pausedSeconds: snapshot.pausedSeconds,
        };
        if (!cancelled) onError(null);
      } catch {
        if (!cancelled && !keepalive) {
          onError("进度暂未同步到服务器，已继续保存在本机。");
        }
      }
    }

    const interval = window.setInterval(() => void syncProgress(), 10_000);
    const saveBeforeLeaving = () => void syncProgress(true);
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") saveBeforeLeaving();
    };

    window.addEventListener("pagehide", saveBeforeLeaving);
    document.addEventListener("visibilitychange", saveWhenHidden);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("pagehide", saveBeforeLeaving);
      document.removeEventListener("visibilitychange", saveWhenHidden);
    };
  }, [enabled, isOnline, onError, sessionId]);
}
