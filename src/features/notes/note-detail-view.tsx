"use client";

import {
  ArchiveRestore,
  Check,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  MoreHorizontal,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { MessageResponse } from "@/components/ai-elements/message";
import { BottomSheet } from "@/components/student/interaction-overlays";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AgentNoteView } from "@/features/agent/agent-note-types";
import { normalizeLatexDelimiters } from "@/lib/markdown/normalize-latex";
import { cn } from "@/lib/utils";

type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { message: string } };

type LeafTag = { id: string; name: string; path: string | null };
type SaveState = "idle" | "waiting" | "saving" | "saved" | "error";

function citationDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const citation = value as Record<string, unknown>;
  return {
    title: typeof citation.title === "string" ? citation.title : "课程引用",
    quote: typeof citation.quote === "string" ? citation.quote : null,
    url: typeof citation.url === "string" ? citation.url : null,
  };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="student-heading mb-3 text-lg font-semibold">{children}</h2>;
}

export function NoteDetailView({
  initialNote,
  leafTags,
}: {
  initialNote: AgentNoteView;
  leafTags: LeafTag[];
}) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [userNote, setUserNote] = useState(initialNote.userNote ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [moreOpen, setMoreOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [humanTagIds, setHumanTagIds] = useState(
    initialNote.tags.filter((tag) => tag.attachedBy === "HUMAN").map((tag) => tag.id)
  );
  const lastSavedUserNote = useRef(initialNote.userNote ?? "");
  const latestUserNote = useRef(initialNote.userNote ?? "");

  const sourceHref =
    typeof note.sourceContext?.sourceHref === "string" ? note.sourceContext.sourceHref : null;
  const isGenerating = note.status === "PENDING" || note.status === "PROCESSING";

  useEffect(() => {
    latestUserNote.current = userNote;
    if (userNote === lastSavedUserNote.current || note.trashedAt) return;
    setSaveState("waiting");
    const timer = window.setTimeout(async () => {
      const valueToSave = latestUserNote.current;
      setSaveState("saving");
      try {
        const response = await fetch(`/api/agent/notes/${note.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userNote: valueToSave }),
        });
        const payload = (await response.json()) as ApiResponse<AgentNoteView>;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.ok ? "保存失败" : payload.error.message);
        }
        lastSavedUserNote.current = valueToSave;
        setSaveState(latestUserNote.current === valueToSave ? "saved" : "waiting");
      } catch {
        setSaveState("error");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [note.id, note.trashedAt, userNote]);

  useEffect(() => {
    if (!isGenerating || note.trashedAt) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/agent/notes/${note.id}`);
        const payload = (await response.json()) as ApiResponse<AgentNoteView>;
        if (response.ok && payload.ok) setNote(payload.data);
      } catch {
        // Keep the current readable snapshot if a status refresh fails.
      }
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [isGenerating, note.id, note.trashedAt]);

  async function refreshNote() {
    const response = await fetch(`/api/agent/notes/${note.id}`);
    const payload = (await response.json()) as ApiResponse<AgentNoteView>;
    if (!response.ok || !payload.ok) {
      throw new Error(payload.ok ? "读取笔记失败" : payload.error.message);
    }
    setNote(payload.data);
    return payload.data;
  }

  async function postAction(path: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(path, { method: "POST" });
      const payload = (await response.json()) as ApiResponse<unknown>;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "操作失败" : payload.error.message);
      }
      await refreshNote();
      setMoreOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function trashNote() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/agent/notes/${note.id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<unknown>;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "删除失败" : payload.error.message);
      }
      router.push("/notes");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除失败");
      setBusy(false);
    }
  }

  async function saveHumanTags() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/agent/notes/${note.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ humanTagIds }),
      });
      const payload = (await response.json()) as ApiResponse<AgentNoteView>;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "知识点保存失败" : payload.error.message);
      }
      setNote(payload.data);
      setHumanTagIds(
        payload.data.tags.filter((tag) => tag.attachedBy === "HUMAN").map((tag) => tag.id)
      );
      setTagsOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "知识点保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <article className="mx-auto w-full max-w-[52rem]">
        <header className="border-b-2 border-foreground pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{note.source === "TUTOR" ? "讲题笔记" : "课程笔记"}</span>
                {isGenerating ? (
                  <span className="inline-flex items-center gap-1">
                    <LoaderCircle
                      className="size-3.5 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    正在整理
                  </span>
                ) : null}
                {note.status === "FAILED" ? (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <CircleAlert className="size-3.5" aria-hidden="true" />
                    整理遇到问题
                  </span>
                ) : null}
              </div>
              <h1 className="student-heading text-2xl font-semibold leading-tight md:text-3xl">
                {note.title}
              </h1>
            </div>
            {!note.trashedAt ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label="更多笔记操作"
                onClick={() => setMoreOpen(true)}
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          {note.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {note.tags.map((tag) => (
                <span key={tag.id} className="bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {tag.name}
                </span>
              ))}
            </div>
          ) : null}
        </header>

        {error ? (
          <p className="mt-4 border-l-4 border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="space-y-9 py-7 md:py-9">
          {note.status === "FAILED" ? (
            <section className="flex flex-col gap-3 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-destructive">
                这次没有整理成功，原回答仍然完整保留。
              </p>
              {!note.trashedAt ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void postAction(`/api/agent/notes/${note.id}/regenerate`)}
                >
                  <RotateCcw data-icon="inline-start" />
                  重新整理
                </Button>
              ) : null}
            </section>
          ) : null}

          {note.aiMarkdown ? (
            <section aria-labelledby="note-summary">
              <SectionTitle>整理笔记</SectionTitle>
              <div className="border-l-4 border-primary bg-card px-4 py-4 md:px-6">
                <MessageResponse>
                  {normalizeLatexDelimiters(note.aiMarkdown)}
                </MessageResponse>
              </div>
            </section>
          ) : isGenerating ? (
            <section className="bg-card px-5 py-8 text-center text-sm text-muted-foreground">
              <LoaderCircle
                className="mx-auto mb-3 size-5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              正在把回答整理成方便复习的笔记
            </section>
          ) : null}

          {note.keyPoints.length > 0 ? (
            <section>
              <SectionTitle>记住这几点</SectionTitle>
              <ol className="space-y-3">
                {note.keyPoints.map((item, index) => (
                  <li
                    key={`${index}-${item}`}
                    className="grid grid-cols-[2rem_1fr] gap-3 text-sm leading-7"
                  >
                    <span className="font-mono text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {note.pitfalls.length > 0 ? (
            <section>
              <SectionTitle>容易出错的地方</SectionTitle>
              <ul className="space-y-2 border-l-2 border-warning/60 pl-4 text-sm leading-7">
                {note.pitfalls.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ) : null}

          {note.applications.length > 0 ? (
            <section>
              <SectionTitle>什么时候能用</SectionTitle>
              <ul className="flex flex-wrap gap-2">
                {note.applications.map((item) => (
                  <li key={item} className="bg-muted px-3 py-2 text-sm">{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {!note.trashedAt ? (
            <section className="border-y border-foreground/20 py-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <SectionTitle>写下我的理解</SectionTitle>
                <span className="text-xs text-muted-foreground" aria-live="polite">
                  {saveState === "waiting" ? "等待保存" : null}
                  {saveState === "saving" ? "正在保存…" : null}
                  {saveState === "saved" ? (
                    <span className="inline-flex items-center gap-1">
                      <Check className="size-3.5" aria-hidden="true" />
                      已保存
                    </span>
                  ) : null}
                  {saveState === "error" ? "保存失败，请继续编辑后重试" : null}
                </span>
              </div>
              <Textarea
                value={userNote}
                onChange={(event) => setUserNote(event.target.value)}
                rows={5}
                placeholder="记下自己的理解、口诀或下次复习提醒"
                aria-label="我的理解"
                className="bg-card"
              />
            </section>
          ) : null}

          <details className="border-y border-foreground/20">
            <summary className="flex min-h-12 cursor-pointer items-center py-3 text-sm font-medium">
              查看原始问题与回答
            </summary>
            <div className="space-y-5 border-t border-foreground/15 py-5">
              {note.originalPrompt ? (
                <div>
                  <div className="mb-2 text-xs text-muted-foreground">原始问题</div>
                  <p className="whitespace-pre-wrap text-sm leading-7">{note.originalPrompt}</p>
                </div>
              ) : null}
              <div>
                <div className="mb-2 text-xs text-muted-foreground">Agent 原回答</div>
                <MessageResponse>
                  {normalizeLatexDelimiters(note.originalContent)}
                </MessageResponse>
              </div>
            </div>
          </details>

          {note.citations.length > 0 ? (
            <details className="border-y border-foreground/20">
              <summary className="flex min-h-12 cursor-pointer items-center py-3 text-sm font-medium">
                查看课程引用（{note.citations.length}）
              </summary>
              <ul className="divide-y border-t border-foreground/15">
                {note.citations.map((value, index) => {
                  const citation = citationDetails(value);
                  if (!citation) return null;
                  return (
                    <li key={`${index}-${citation.title}`} className="py-4 text-sm">
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
                        <blockquote className="mt-2 border-l-2 pl-3 leading-6 text-muted-foreground">
                          {citation.quote}
                        </blockquote>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </details>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {note.trashedAt ? (
              <Button
                type="button"
                className="min-h-11"
                disabled={busy}
                onClick={() => void postAction(`/api/agent/notes/${note.id}/restore`)}
              >
                <ArchiveRestore data-icon="inline-start" />
                恢复笔记
              </Button>
            ) : sourceHref ? (
              <Link
                href={sourceHref}
                className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
              >
                <ExternalLink data-icon="inline-start" />
                回到原来的内容
              </Link>
            ) : null}
          </div>
        </div>
      </article>

      <BottomSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title="更多操作"
        description="调整这条笔记的整理方式或存放位置。"
      >
        <div className="grid gap-2 p-4">
          <Button
            type="button"
            variant="ghost"
            className="min-h-12 justify-start"
            onClick={() => {
              setMoreOpen(false);
              setTagsOpen(true);
            }}
          >
            调整知识点
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-12 justify-start"
            disabled={busy}
            onClick={() => void postAction(`/api/agent/notes/${note.id}/regenerate`)}
          >
            <RotateCcw data-icon="inline-start" />
            重新整理
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-12 justify-start text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => void trashNote()}
          >
            <Trash2 data-icon="inline-start" />
            移到最近删除
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={tagsOpen}
        onOpenChange={setTagsOpen}
        title="调整知识点"
        description="系统会自动添加知识点，你也可以补充自己的判断。"
      >
        <div className="grid max-h-[60dvh] gap-2 overflow-y-auto p-4 sm:grid-cols-2">
          {leafTags.map((tag) => (
            <label key={tag.id} className="flex min-h-11 items-center gap-3 text-sm">
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
        <div className="border-t p-4">
          <Button
            type="button"
            className="min-h-11 w-full"
            disabled={busy}
            onClick={() => void saveHumanTags()}
          >
            完成
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
