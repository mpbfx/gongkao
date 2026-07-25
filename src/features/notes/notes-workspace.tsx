"use client";

import { ArrowRight, BookOpenCheck, CircleAlert, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import type {
  AgentNoteListResponse,
  AgentNoteView,
} from "@/features/agent/agent-note-types";
import { cn } from "@/lib/utils";

type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { message: string } };

function noteDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function noteExcerpt(note: AgentNoteView) {
  return note.keyPoints[0] || note.originalPrompt || note.aiMarkdown || note.originalContent;
}

function NoteProgress({ status }: { status: AgentNoteView["status"] }) {
  if (status === "READY") return null;
  if (status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
        <CircleAlert className="size-3.5" aria-hidden="true" />
        整理遇到问题
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <LoaderCircle
        className="size-3.5 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      正在整理
    </span>
  );
}

export function NotesWorkspace({
  initialData,
  queryString,
  trashed = false,
}: {
  initialData: AgentNoteListResponse;
  queryString: string;
  trashed?: boolean;
}) {
  const [data, setData] = useState(initialData);
  const hasPendingNotes = useMemo(
    () => data.items.some((note) => note.status === "PENDING" || note.status === "PROCESSING"),
    [data.items]
  );

  useEffect(() => {
    if (!hasPendingNotes) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/agent/notes${queryString ? `?${queryString}` : ""}`);
        const payload = (await response.json()) as ApiResponse<AgentNoteListResponse>;
        if (response.ok && payload.ok) setData(payload.data);
      } catch {
        // A temporary refresh failure should not interrupt reading.
      }
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [hasPendingNotes, queryString]);

  if (data.items.length === 0) {
    return (
      <section className="grid min-h-80 place-items-center border-y border-foreground/25 bg-card/30 px-6 text-center">
        <div className="max-w-sm">
          <BookOpenCheck className="mx-auto size-9 text-primary" aria-hidden="true" />
          <h2 className="student-heading mt-4 text-xl font-semibold">
            {trashed ? "最近没有删除的笔记" : "从一条值得记住的回答开始"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {trashed
              ? "移入最近删除的笔记会保留在这里，随时可以恢复。"
              : "在讲题助教或课程知识的回答下点击“收藏”，系统会自动整理成复习卡片。"}
          </p>
          {!trashed ? (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/knowledge" className={cn(buttonVariants(), "min-h-11")}>
                去课程知识
              </Link>
              <Link
                href="/question-bank/special"
                className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
              >
                开始练习
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section aria-label={trashed ? "最近删除的学习笔记" : "学习笔记"}>
      <div className="mb-3 flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>{data.pagination.total} 条笔记</span>
        {hasPendingNotes ? <span>新收藏会自动完成整理</span> : null}
      </div>
      <div className="space-y-3">
        {data.items.map((note) => (
          <Link
            key={note.id}
            href={`/notes/${note.id}`}
            className="group relative block min-h-36 overflow-hidden border border-foreground/15 bg-card px-5 py-5 transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transform-none sm:px-6"
          >
            <span
              className={cn(
                "absolute inset-y-0 left-0 w-1",
                note.source === "TUTOR" ? "bg-primary" : "bg-info"
              )}
              aria-hidden="true"
            />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{note.source === "TUTOR" ? "讲题笔记" : "课程笔记"}</span>
                  <span>{noteDate(note.createdAt)}</span>
                  <NoteProgress status={note.status} />
                </div>
                <h2 className="student-heading mt-2 line-clamp-2 text-lg font-semibold leading-7">
                  {note.title}
                </h2>
              </div>
              <ArrowRight
                className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
                aria-hidden="true"
              />
            </div>
            <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {noteExcerpt(note)}
            </p>
            {note.tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {note.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag.id}
                    className="bg-muted px-2 py-1 text-[0.68rem] text-muted-foreground"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
