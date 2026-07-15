"use client";

import { useEffect, useRef, useState } from "react";

export function usePracticeTimer({
  initialElapsedSeconds,
  timeLimitSeconds,
  deadlineAt,
  serverNow,
  timingMode,
  disabled,
  onActiveSecond,
  onExpire,
}: {
  initialElapsedSeconds: number;
  timeLimitSeconds?: number | null;
  deadlineAt?: string | null;
  serverNow?: string | null;
  timingMode: string;
  disabled: boolean;
  onActiveSecond: () => void;
  onExpire: (elapsedSeconds: number) => void;
}) {
  const serverOffsetMs = useRef(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsedSeconds);
  const [clockReady, setClockReady] = useState(
    timingMode !== "STRICT" || !timeLimitSeconds || !deadlineAt
  );
  const [isPaused, setIsPaused] = useState(false);
  const [pauseCount, setPauseCount] = useState(0);
  const [pausedSeconds, setPausedSeconds] = useState(0);
  const expiredRef = useRef(false);
  const activeSecondRef = useRef(onActiveSecond);
  const expireRef = useRef(onExpire);

  useEffect(() => {
    activeSecondRef.current = onActiveSecond;
    expireRef.current = onExpire;
  }, [onActiveSecond, onExpire]);

  useEffect(() => {
    if (timingMode !== "STRICT" || !timeLimitSeconds || !deadlineAt) {
      return;
    }

    const initializationTimer = window.setTimeout(() => {
      serverOffsetMs.current = serverNow
        ? new Date(serverNow).getTime() - Date.now()
        : 0;
      const deadlineMs = new Date(deadlineAt).getTime();
      const serverElapsed = Math.max(
        0,
        Math.floor(
          (Date.now() + serverOffsetMs.current - (deadlineMs - timeLimitSeconds * 1000)) / 1000
        )
      );
      setElapsedSeconds((seconds) =>
        Math.min(timeLimitSeconds, Math.max(seconds, serverElapsed))
      );
      setClockReady(true);
    }, 0);

    return () => window.clearTimeout(initializationTimer);
  }, [deadlineAt, serverNow, timeLimitSeconds, timingMode]);

  useEffect(() => {
    if (
      disabled ||
      !clockReady ||
      !timeLimitSeconds ||
      elapsedSeconds < timeLimitSeconds ||
      expiredRef.current
    ) {
      return;
    }

    expiredRef.current = true;
    window.setTimeout(() => expireRef.current(elapsedSeconds), 0);
  }, [clockReady, disabled, elapsedSeconds, timeLimitSeconds]);

  useEffect(() => {
    if (disabled || !clockReady) return;
    const timer = window.setInterval(() => {
      if (isPaused) {
        setPausedSeconds((seconds) => seconds + 1);
        return;
      }
      setElapsedSeconds((seconds) => {
        const strictElapsed = timingMode === "STRICT" && timeLimitSeconds && deadlineAt
          ? Math.max(
              0,
              Math.floor(
                (Date.now() + serverOffsetMs.current -
                  (new Date(deadlineAt).getTime() - timeLimitSeconds * 1000)) / 1000
              )
            )
          : null;
        const next = strictElapsed === null ? seconds + 1 : Math.max(seconds + 1, strictElapsed);
        activeSecondRef.current();
        if (timeLimitSeconds && next >= timeLimitSeconds && !expiredRef.current) {
          expiredRef.current = true;
          window.setTimeout(() => expireRef.current(next), 0);
        }
        return timeLimitSeconds ? Math.min(next, timeLimitSeconds) : next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [clockReady, deadlineAt, disabled, isPaused, timeLimitSeconds, timingMode]);

  function togglePause() {
    if (disabled || timingMode === "STRICT") return;
    setIsPaused((current) => {
      if (!current) setPauseCount((count) => count + 1);
      return !current;
    });
  }

  return {
    elapsedSeconds,
    setElapsedSeconds,
    isPaused,
    setIsPaused,
    pauseCount,
    setPauseCount,
    pausedSeconds,
    setPausedSeconds,
    remainingSeconds: timeLimitSeconds ? Math.max(0, timeLimitSeconds - elapsedSeconds) : null,
    togglePause,
  };
}
