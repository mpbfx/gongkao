"use client";

import { useEffect, useRef, useState } from "react";

export function usePracticeTimer({
  initialElapsedSeconds,
  timeLimitSeconds,
  timingMode,
  disabled,
  onActiveSecond,
  onExpire,
}: {
  initialElapsedSeconds: number;
  timeLimitSeconds?: number | null;
  timingMode: string;
  disabled: boolean;
  onActiveSecond: () => void;
  onExpire: (elapsedSeconds: number) => void;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsedSeconds);
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
    if (disabled) return;
    const timer = window.setInterval(() => {
      if (isPaused) {
        setPausedSeconds((seconds) => seconds + 1);
        return;
      }
      setElapsedSeconds((seconds) => {
        const next = seconds + 1;
        activeSecondRef.current();
        if (timeLimitSeconds && next >= timeLimitSeconds && !expiredRef.current) {
          expiredRef.current = true;
          window.setTimeout(() => expireRef.current(next), 0);
        }
        return timeLimitSeconds ? Math.min(next, timeLimitSeconds) : next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [disabled, isPaused, timeLimitSeconds]);

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
