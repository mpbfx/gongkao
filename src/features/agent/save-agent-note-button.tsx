"use client";

import { Bookmark, LoaderCircle, TriangleAlert } from "lucide-react";
import { useState } from "react";

import type {
  AgentNoteReference,
  AgentNoteSource,
} from "@/features/agent/agent-note-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { message: string } };

export function SaveAgentNoteButton({
  source,
  messageId,
  initialReference,
  disabled = false,
  compact = false,
}: {
  source: AgentNoteSource;
  messageId?: string;
  initialReference?: AgentNoteReference;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [reference, setReference] = useState(initialReference?.trashed ? undefined : initialReference);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (!messageId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = reference
        ? await fetch(`/api/agent/notes/${reference.id}`, { method: "DELETE" })
        : await fetch("/api/agent/notes", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ source, messageId }),
          });
      const payload = (await response.json()) as ApiResponse<AgentNoteReference>;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "收藏操作失败。" : payload.error.message);
      }
      setReference(reference ? undefined : payload.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "收藏操作失败。");
    } finally {
      setBusy(false);
    }
  }

  const generatedState =
    reference?.status === "FAILED"
      ? "归纳失败，可在学习笔记中重试"
      : reference?.status === "READY"
        ? "已收藏并完成归纳"
        : reference
          ? "已收藏，正在归纳"
          : "收藏为学习笔记";

  return (
    <div className={cn("mt-2 flex items-center gap-2", compact && "mt-1")}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 gap-1.5 px-2 text-xs text-muted-foreground"
        disabled={disabled || !messageId || busy}
        onClick={() => void toggle()}
        aria-pressed={Boolean(reference)}
        title={generatedState}
      >
        {busy ? (
          <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : reference?.status === "FAILED" ? (
          <TriangleAlert className="size-3.5 text-destructive" aria-hidden="true" />
        ) : (
          <Bookmark
            className={cn("size-3.5", reference && "fill-current text-primary")}
            aria-hidden="true"
          />
        )}
        {reference ? "已收藏" : "收藏"}
      </Button>
      {reference && reference.status !== "READY" ? (
        <span className={cn("text-[0.68rem]", reference.status === "FAILED" ? "text-destructive" : "text-muted-foreground")}>
          {reference.status === "FAILED" ? "归纳失败" : "正在归纳"}
        </span>
      ) : null}
      {error ? <span className="text-[0.68rem] text-destructive" role="alert">{error}</span> : null}
      <span className="sr-only" aria-live="polite">{error ?? generatedState}</span>
    </div>
  );
}
