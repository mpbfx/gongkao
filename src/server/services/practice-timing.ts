export function getPracticeDeadline({
  createdAt,
  timingMode,
  timeLimitSeconds,
}: {
  createdAt: Date;
  timingMode: string;
  timeLimitSeconds?: number | null;
}) {
  if (timingMode !== "STRICT" || !timeLimitSeconds) {
    return null;
  }

  return new Date(createdAt.getTime() + timeLimitSeconds * 1000);
}

export function normalizeSubmittedTiming({
  createdAt,
  timingMode,
  timeLimitSeconds,
  elapsedSeconds,
  pauseCount,
  pausedSeconds,
  now = new Date(),
}: {
  createdAt: Date;
  timingMode: string;
  timeLimitSeconds?: number | null;
  elapsedSeconds: number;
  pauseCount: number;
  pausedSeconds: number;
  now?: Date;
}) {
  if (timingMode !== "STRICT" || !timeLimitSeconds) {
    return { elapsedSeconds, pauseCount, pausedSeconds };
  }

  const serverElapsedSeconds = Math.max(
    0,
    Math.floor((now.getTime() - createdAt.getTime()) / 1000)
  );

  return {
    elapsedSeconds: Math.min(
      timeLimitSeconds,
      Math.max(elapsedSeconds, serverElapsedSeconds)
    ),
    pauseCount: 0,
    pausedSeconds: 0,
  };
}
