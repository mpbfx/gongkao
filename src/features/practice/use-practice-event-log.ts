"use client";

import { useRef, useState } from "react";

import type { PracticeEventDraft } from "@/lib/offline/practice-drafts";

export function usePracticeEventLog(initialQuestionId: string) {
  const [events, setEvents] = useState<PracticeEventDraft[]>(() => [
    { questionId: initialQuestionId, type: "QUESTION_VIEW", occurredAt: new Date().toISOString() },
  ]);
  const visitedQuestionIds = useRef(new Set([initialQuestionId]));

  function record(event: Omit<PracticeEventDraft, "occurredAt">) {
    setEvents((current) => [...current, { ...event, occurredAt: new Date().toISOString() }]);
  }

  function recordVisit(questionId: string) {
    const returning = visitedQuestionIds.current.has(questionId);
    visitedQuestionIds.current.add(questionId);
    record({ questionId, type: returning ? "RETURN" : "QUESTION_VIEW" });
  }

  return { events, setEvents, record, recordVisit };
}
