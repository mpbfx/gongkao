"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ApiResponse, WrongQuestionDTO } from "@/features/wrong-questions/wrong-review-types";

export type MasteredCelebration = {
  item: WrongQuestionDTO;
  tagName?: string | null;
  remainingCount: number;
};

export function useWrongReviewActions() {
  const router = useRouter();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isStarting, setIsStarting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoredItem, setRestoredItem] = useState<WrongQuestionDTO | null>(null);
  const [masteredCelebration, setMasteredCelebration] = useState<MasteredCelebration | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function softRefresh() {
    startRefreshTransition(() => {
      router.refresh();
    });
  }

  async function startWrongSession(input: { tagId?: string | null; count: number }) {
    setIsStarting(true);
    setActionError(null);
    setRestoredItem(null);

    try {
      const response = await fetch("/api/practice/sessions/wrong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "WRONG", tagId: input.tagId, count: input.count }),
      });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;

      if (!payload.ok) {
        setActionError(payload.error.message);
        return;
      }

      router.push(`/practice/${payload.data.id}`);
    } catch {
      setActionError("错题练习创建失败，请稍后重试。");
    } finally {
      setIsStarting(false);
    }
  }

  async function resolveWrongQuestion(
    item: WrongQuestionDTO,
    options?: { tagName?: string | null; remainingCount?: number }
  ) {
    if (item.resolvedAt || resolvingId === item.id) {
      return false;
    }

    setResolvingId(item.id);
    setActionError(null);
    setRestoredItem(null);

    try {
      const response = await fetch(`/api/wrong-questions/${item.id}/resolve`, { method: "POST" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;

      if (!payload.ok) {
        setActionError(payload.error.message);
        return false;
      }

      setMasteredCelebration({
        item,
        tagName: options?.tagName,
        remainingCount: Math.max(0, options?.remainingCount ?? 0),
      });
      // Do not refresh immediately — wait until the toast is dismissed so the
      // three-pane workspace does not reflow under the click.
      return true;
    } catch {
      setActionError("标记已掌握失败，请稍后重试。");
      return false;
    } finally {
      setResolvingId(null);
    }
  }

  async function restoreWrongQuestion(item: WrongQuestionDTO) {
    setRestoringId(item.id);
    setActionError(null);
    setMasteredCelebration(null);

    try {
      const response = await fetch(`/api/wrong-questions/${item.id}/restore`, { method: "POST" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;

      if (!payload.ok) {
        setActionError(payload.error.message);
        return;
      }

      setRestoredItem(item);
      softRefresh();
    } catch {
      setActionError("恢复错题失败，请稍后重试。");
    } finally {
      setRestoringId(null);
    }
  }

  async function undoRestore() {
    if (!restoredItem) {
      return;
    }

    setRestoringId(restoredItem.id);
    setActionError(null);

    try {
      const response = await fetch(`/api/wrong-questions/${restoredItem.id}/resolve`, { method: "POST" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;

      if (!payload.ok) {
        setActionError(payload.error.message);
        return;
      }

      setRestoredItem(null);
      softRefresh();
    } catch {
      setActionError("撤销恢复失败，请稍后重试。");
    } finally {
      setRestoringId(null);
    }
  }

  function clearMasteredCelebration() {
    setMasteredCelebration(null);
    softRefresh();
  }

  return {
    actionError,
    clearActionError: () => setActionError(null),
    clearMasteredCelebration,
    clearRestoredItem: () => setRestoredItem(null),
    isRefreshing,
    isStarting,
    masteredCelebration,
    resolveWrongQuestion,
    restoredItem,
    restoringId,
    restoringOrResolvingId: restoringId ?? resolvingId,
    resolvingId,
    restoreWrongQuestion,
    startWrongSession,
    undoRestore,
  };
}
