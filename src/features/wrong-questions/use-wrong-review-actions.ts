"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ApiResponse, WrongQuestionDTO } from "@/features/wrong-questions/wrong-review-types";

export function useWrongReviewActions() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoredItem, setRestoredItem] = useState<WrongQuestionDTO | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  async function restoreWrongQuestion(item: WrongQuestionDTO) {
    setRestoringId(item.id);
    setActionError(null);

    try {
      const response = await fetch(`/api/wrong-questions/${item.id}/restore`, { method: "POST" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;

      if (!payload.ok) {
        setActionError(payload.error.message);
        return;
      }

      setRestoredItem(item);
      router.refresh();
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
      router.refresh();
    } catch {
      setActionError("撤销恢复失败，请稍后重试。");
    } finally {
      setRestoringId(null);
    }
  }

  return {
    actionError,
    clearActionError: () => setActionError(null),
    clearRestoredItem: () => setRestoredItem(null),
    isStarting,
    restoredItem,
    restoringId,
    restoreWrongQuestion,
    startWrongSession,
    undoRestore,
  };
}
