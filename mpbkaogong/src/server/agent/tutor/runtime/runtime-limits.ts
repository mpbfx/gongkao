export const tutorRuntimeLimits = {
  maxTurns: 4,
  maxToolCalls: 6,
  timeoutMs: 45_000,
  historyMessages: 16,
  contextCharacters: 24_000,
  toolResultCharacters: 4_000,
} as const;
