"use client";

import {
  ArchiveRestore,
  BookOpenCheck,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { MessageResponse } from "@/components/ai-elements/message";
import { ResponsiveDrawer } from "@/components/student/interaction-overlays";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  AgentNoteListResponse,
  AgentNoteView,
} from "@/features/agent/agent-note-types";
import { normalizeLatexDelimiters } from "@/lib/markdown/normalize-latex";
import { cn } from "@/lib/utils";

type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { message: string } };

type LeafTag = { id: string; name: string; path: string | null };

const statusLabels = {
  PENDING: "等待归纳",
  PROCESSING: "正在归纳",
  READY: "归纳完成",
  FAILED: "归纳失败",
} as const;

function citationDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const citation = value as Record<string, unknown>;
  return {
    title: typeof citation.title === "string" ? citation.title : "课程引用",
    quote: typeof citation.quote === "string" ? citation.quote : null,
    url: typeof citation.url === "string" ? citation.url : null,
  };
}

function NoteStatus({ note }: { note: AgentNoteView }) {
  const variant =
    note.status === "READY"
      ? "success"
      : note.status === "FAILED"
        ? "destructive"
        : "warning";
  return <Badge variant={variant}>{statusLabels[note.status]}</Badge>;
}

function NoteDetail({
  note,
  leafTags,
  onChanged,
}: {
  note: AgentNoteView;
  leafTags: LeafTag[];
  onChanged: () => Promise<void>;
}) {
  const [userNote, setUserNote] = useState(note.userNote ?? "");
  const [humanTagIds, setHumanTagIds] = useState(
    note.tags.filter((item) => item.attachedBy === "HUMAN").map((item) => item.id)
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceContext = note.sourceContext;
  const sourceHref = typeof sourceContext?.sourceHref === "string" ? sourceContext.sourceHref : null;

  async function mutate(path: string, init: RequestInit) {
    setBusy(path);
    setError(null);
    try {
      const response = await fetch(path, init);
      const payload = (await response.json()) as ApiResponse<unknown>;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "操作失败。" : payload.error.message);
      }
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作失败。");
    } finally {
      setBusy(null);
    }
  }

  async function saveManualContent() {
    await mutate(`/api/agent/notes/${note.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userNote, humanTagIds }),
    });
  }

  return (
    <article className="min-w-0">
      <header className="border-b-2 border-foreground px-4 py-4 lg:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <NoteStatus note={note} />
          <Badge variant="outline">{note.source === "TUTOR" ? "讲题助教" : "课程知识"}</Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(note.createdAt).toLocaleString("zh-CN")}
          </span>
        </div>
        <h2 className="student-heading mt-3 text-xl font-semibold leading-tight">{note.title}</h2>
        {error ? <p className="mt-2 text-sm text-destructive" role="alert">{error}</p> : null}
      </header>

      <div className="space-y-6 p-4 lg:p-5">
        {note.status === "FAILED" ? (
          <div className="border border-destructive/35 bg-destructive/5 p-3 text-sm text-destructive">
            {note.errorMessage || "自动归纳失败，可以重新归纳。"}
          </div>
        ) : null}

        {note.aiMarkdown ? (
          <section aria-labelledby={`note-summary-${note.id}`}>
            <h3 id={`note-summary-${note.id}`} className="student-heading mb-2 font-semibold">归纳笔记</h3>
            <div className="border-l-4 border-primary bg-muted/30 px-4 py-3">
              <MessageResponse>{normalizeLatexDelimiters(note.aiMarkdown)}</MessageResponse>
            </div>
          </section>
        ) : (
          <div className="flex items-center gap-2 border-y py-5 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            后台正在整理这条回答
          </div>
        )}

        {note.keyPoints.length > 0 ? (
          <section>
            <h3 className="student-heading mb-2 font-semibold">核心要点</h3>
            <ol className="space-y-2">
              {note.keyPoints.map((item, index) => (
                <li key={`${index}-${item}`} className="grid grid-cols-[1.75rem_1fr] gap-2 text-sm leading-6">
                  <span className="font-mono text-primary">{String(index + 1).padStart(2, "0")}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {note.pitfalls.length > 0 || note.applications.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            <section>
              <h3 className="student-heading mb-2 font-semibold">易错提醒</h3>
              <ul className="space-y-2 text-sm leading-6">
                {note.pitfalls.map((item) => <li key={item}>— {item}</li>)}
              </ul>
            </section>
            <section>
              <h3 className="student-heading mb-2 font-semibold">适用场景</h3>
              <ul className="space-y-2 text-sm leading-6">
                {note.applications.map((item) => <li key={item}>— {item}</li>)}
              </ul>
            </section>
          </div>
        ) : null}

        <section>
          <h3 className="student-heading mb-2 font-semibold">知识标签</h3>
          <div className="mb-3 flex flex-wrap gap-2">
            {note.tags.map((tag) => (
              <Badge key={tag.id} variant={tag.attachedBy === "HUMAN" ? "default" : "secondary"}>
                {tag.name}{tag.attachedBy === "AI" ? " · AI" : ""}
              </Badge>
            ))}
            {note.tags.length === 0 ? <span className="text-sm text-muted-foreground">尚未匹配知识点</span> : null}
          </div>
          <details className="border border-foreground/20">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">调整人工标签</summary>
            <div className="grid max-h-56 gap-2 overflow-y-auto border-t p-3 sm:grid-cols-2">
              {leafTags.map((tag) => (
                <label key={tag.id} className="flex min-h-9 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={humanTagIds.includes(tag.id)}
                    onChange={(event) =>
                      setHumanTagIds((current) =>
                        event.target.checked
                          ? [...new Set([...current, tag.id])]
                          : current.filter((id) => id !== tag.id)
                      )
                    }
                  />
                  <span>{tag.path || tag.name}</span>
                </label>
              ))}
            </div>
          </details>
        </section>

        <section>
          <label className="student-heading mb-2 block font-semibold" htmlFor={`user-note-${note.id}`}>
            我的补充
          </label>
          <Textarea
            id={`user-note-${note.id}`}
            value={userNote}
            onChange={(event) => setUserNote(event.target.value)}
            rows={5}
            placeholder="记录自己的理解、口诀或下次复习提醒"
          />
          <Button
            type="button"
            className="mt-2"
            disabled={busy !== null}
            onClick={() => void saveManualContent()}
          >
            <Save data-icon="inline-start" />保存补充与标签
          </Button>
        </section>

        <details className="border-y border-foreground/30 py-2">
          <summary className="cursor-pointer py-2 text-sm font-medium">查看原始问题与回答</summary>
          <div className="space-y-4 py-3">
            {note.originalPrompt ? (
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">原始问题</div>
                <p className="whitespace-pre-wrap text-sm leading-6">{note.originalPrompt}</p>
              </div>
            ) : null}
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Agent 原回答</div>
              <MessageResponse>{normalizeLatexDelimiters(note.originalContent)}</MessageResponse>
            </div>
          </div>
        </details>

        {note.citations.length > 0 ? (
          <section aria-labelledby={`note-citations-${note.id}`}>
            <h3 id={`note-citations-${note.id}`} className="student-heading mb-2 font-semibold">
              课程引用
            </h3>
            <ul className="divide-y border-y border-foreground/20">
              {note.citations.map((value, index) => {
                const citation = citationDetails(value);
                if (!citation) return null;
                return (
                  <li key={`${index}-${citation.title}`} className="py-3 text-sm">
                    {citation.url ? (
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium underline decoration-primary/50 underline-offset-4"
                      >
                        {citation.title}
                      </a>
                    ) : (
                      <span className="font-medium">{citation.title}</span>
                    )}
                    {citation.quote ? (
                      <blockquote className="mt-1 border-l-2 pl-3 text-muted-foreground">
                        {citation.quote}
                      </blockquote>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          {sourceHref ? (
            <Link href={sourceHref} className={cn(buttonVariants({ variant: "outline" }))}>
              <ExternalLink data-icon="inline-start" />回到来源
            </Link>
          ) : null}
          {note.trashedAt ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void mutate(`/api/agent/notes/${note.id}/restore`, { method: "POST" })}
            >
              <ArchiveRestore data-icon="inline-start" />恢复笔记
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void mutate(`/api/agent/notes/${note.id}/regenerate`, { method: "POST" })}
              >
                <RotateCcw data-icon="inline-start" />重新归纳
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void mutate(`/api/agent/notes/${note.id}`, { method: "DELETE" })}
              >
                <Trash2 data-icon="inline-start" />移入回收站
              </Button>
            </>
          )}
          <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void onChanged()}>
            <RefreshCw data-icon="inline-start" />刷新状态
          </Button>
        </div>
      </div>
    </article>
  );
}

export function NotesWorkspace({
  initialData,
  leafTags,
  queryString,
}: {
  initialData: AgentNoteListResponse;
  leafTags: LeafTag[];
  queryString: string;
}) {
  const [data, setData] = useState(initialData);
  const [selectedId, setSelectedId] = useState(initialData.items[0]?.id ?? null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const selected = useMemo(
    () => data.items.find((item) => item.id === selectedId) ?? data.items[0] ?? null,
    [data.items, selectedId]
  );

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch(`/api/agent/notes${queryString ? `?${queryString}` : ""}`);
      const payload = (await response.json()) as ApiResponse<AgentNoteListResponse>;
      if (response.ok && payload.ok) {
        setData(payload.data);
        if (!payload.data.items.some((item) => item.id === selectedId)) {
          setSelectedId(payload.data.items[0]?.id ?? null);
          setDrawerOpen(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  if (data.items.length === 0) {
    return (
      <div className="grid min-h-72 place-items-center border-y border-foreground/40 bg-card/40 px-5 text-center">
        <div>
          <BookOpenCheck className="mx-auto size-8 text-primary" aria-hidden="true" />
          <h2 className="student-heading mt-3 text-lg font-semibold">还没有匹配的学习笔记</h2>
          <p className="mt-1 text-sm text-muted-foreground">在讲题助教或课程知识回答下点击“收藏”。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[36rem] gap-4 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.5fr)]">
      <section className="min-w-0 border-y border-foreground/45 bg-card/40" aria-label="学习笔记列表">
        <div className="flex h-11 items-center justify-between border-b px-3">
          <span className="text-xs font-medium text-muted-foreground">共 {data.pagination.total} 条</span>
          {loading ? <LoaderCircle className="size-4 animate-spin" aria-label="正在刷新" /> : null}
        </div>
        <div className="divide-y divide-foreground/15">
          {data.items.map((note) => (
            <button
              key={note.id}
              type="button"
              className={cn(
                "block min-h-28 w-full px-4 py-3 text-left transition-colors hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none",
                selected?.id === note.id && "bg-primary/5 lg:border-l-4 lg:border-primary"
              )}
              onClick={() => {
                setSelectedId(note.id);
                setDrawerOpen(true);
              }}
            >
              <div className="flex items-center gap-2">
                <NoteStatus note={note} />
                <span className="text-[0.68rem] text-muted-foreground">{note.source === "TUTOR" ? "讲题" : "知识"}</span>
              </div>
              <h3 className="mt-2 line-clamp-2 font-medium leading-5">{note.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {note.aiMarkdown || note.originalContent}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="hidden min-w-0 border-y border-foreground/45 bg-card/40 lg:block" aria-label="学习笔记详情">
        {selected ? <NoteDetail key={selected.id} note={selected} leafTags={leafTags} onChanged={refresh} /> : null}
      </section>

      <ResponsiveDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={selected?.title ?? "学习笔记"}
        description="查看归纳结果、原始回答和个人补充"
        className="lg:hidden"
      >
        {selected ? <NoteDetail key={selected.id} note={selected} leafTags={leafTags} onChanged={refresh} /> : null}
      </ResponsiveDrawer>
    </div>
  );
}
