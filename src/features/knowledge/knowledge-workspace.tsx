"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { BookOpenText, ExternalLink, History, LoaderCircle, MessageSquarePlus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { ResponsiveDrawer } from "@/components/student/interaction-overlays";
import { Button } from "@/components/ui/button";
import type { KnowledgeSessionDetail, KnowledgeSessionSummary, KnowledgeUIMessage } from "@/features/agent/knowledge-ui-message";
import { prepareKnowledgeRequest } from "@/features/agent/knowledge-ui-message";
import { normalizeLatexDelimiters } from "@/lib/markdown/normalize-latex";
import { cn } from "@/lib/utils";

type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { message: string } };

function formatTime(ms: number) {
  const total = Math.floor(ms / 1_000);
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function MessageCitations({ message }: { message: KnowledgeUIMessage }) {
  const citations = message.parts.flatMap((part) => part.type === "data-citations" ? part.data.items : []);
  if (citations.length === 0) return null;
  return (
    <div className="mt-3 grid gap-2" aria-label="课程引用">
      {citations.map((citation, index) => (
        <a
          key={`${citation.chunkId}-${index}`}
          href={citation.url}
          target="_blank"
          rel="noreferrer"
          className="group border border-foreground/20 bg-muted/35 px-3 py-2 text-xs transition-colors hover:border-primary/60 hover:bg-primary/5"
        >
          <div className="flex items-center justify-between gap-2 font-medium">
            <span className="truncate">资料{index + 1} · {citation.title}</span>
            <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
          </div>
          <div className="mt-1 text-muted-foreground">第{citation.partNo}P · {formatTime(citation.startMs)}—{formatTime(citation.endMs)}</div>
          <p className="mt-1 line-clamp-2 leading-5 text-muted-foreground group-hover:text-foreground">{citation.quote}</p>
        </a>
      ))}
    </div>
  );
}

function KnowledgeChat({ sessionId, onSessionUpdated, initialPrompt = "", headerAction }: { sessionId: string; onSessionUpdated: () => void; initialPrompt?: string; headerAction?: React.ReactNode }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [activity, setActivity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const transport = useMemo(
    () => new DefaultChatTransport<KnowledgeUIMessage>({
      api: `/api/agent/knowledge/sessions/${sessionId}/messages`,
      prepareSendMessagesRequest: ({ messages, trigger }) => ({
        body: prepareKnowledgeRequest(messages, trigger === "regenerate-message" ? "regenerate" : "submit"),
      }),
    }),
    [sessionId]
  );
  const { messages, setMessages, sendMessage, stop, status, error } = useChat<KnowledgeUIMessage>({
    id: `knowledge:${sessionId}`,
    transport,
    experimental_throttle: 40,
    onData(part) {
      if (part.type === "data-activity") setActivity(part.data.label);
    },
    onFinish() {
      setActivity(null);
      onSessionUpdated();
    },
    onError() {
      setActivity(null);
    },
  });
  const generating = status === "submitted" || status === "streaming";
  const stopRef = useRef(stop);

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/agent/knowledge/sessions/${sessionId}`, { signal: controller.signal });
        const payload = await response.json() as ApiResponse<KnowledgeSessionDetail>;
        if (!response.ok || !payload.ok) throw new Error(payload.ok ? "读取会话失败。" : payload.error.message);
        setMessages(payload.data.messages);
      } catch (reason) {
        if (!controller.signal.aborted) setLoadError(reason instanceof Error ? reason.message : "读取会话失败。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => {
      controller.abort();
      // Avoid depending on `stop` identity — unstable refs re-run this effect mid-stream.
      void stopRef.current();
    };
  }, [sessionId, setMessages]);

  async function submit(text: string) {
    const next = text.trim();
    if (!next || generating) return;
    setPrompt("");
    setActivity("正在理解问题");
    await sendMessage({ text: next });
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-y border-foreground/35 bg-card/45">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-foreground/20 px-4">
        <div className="flex items-center gap-2">
          <BookOpenText className="size-4" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold">课程知识问答</h2>
            <p className="text-[0.65rem] text-muted-foreground">回答严格来自已导入课程字幕</p>
          </div>
        </div>
        {headerAction}
      </header>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />正在读取会话</div>
          ) : loadError ? (
            <div className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{loadError}</div>
          ) : messages.length === 0 ? (
            <ConversationEmptyState title="从课程中查找答案" description="例如：资料分析中基期量怎么快速计算？" />
          ) : messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {message.parts.filter((part) => part.type === "text").map((part, index) =>
                  message.role === "assistant" ? (
                    <MessageResponse key={`${message.id}-${index}`}>{normalizeLatexDelimiters(part.text)}</MessageResponse>
                  ) : <p className="whitespace-pre-wrap leading-6" key={`${message.id}-${index}`}>{part.text}</p>
                )}
                {message.role === "assistant" ? <MessageCitations message={message} /> : null}
              </MessageContent>
            </Message>
          ))}
          {generating ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" />{activity ?? "正在生成回答"}</div> : null}
          {error ? <div className="text-sm text-destructive">{error.message}</div> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="shrink-0 border-t border-foreground/20 bg-muted/20 p-3">
        <PromptInput onSubmit={({ text }) => submit(text)}>
          <PromptInputBody>
            <PromptInputTextarea value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={generating} aria-label="询问课程知识" />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputSubmit status={status} disabled={!generating && !prompt.trim()} onStop={() => void stop()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </section>
  );
}

export function KnowledgeWorkspace({ initialSessions, initialPrompt }: { initialSessions: KnowledgeSessionSummary[]; initialPrompt?: string }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [selectedId, setSelectedId] = useState(initialSessions[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  async function refreshSessions() {
    const response = await fetch("/api/agent/knowledge/sessions");
    const payload = await response.json() as ApiResponse<KnowledgeSessionSummary[]>;
    if (payload.ok) setSessions(payload.data);
  }

  async function createSession() {
    setBusy(true);
    setWorkspaceError(null);
    try {
      const response = await fetch("/api/agent/knowledge/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const payload = await response.json() as ApiResponse<KnowledgeSessionSummary>;
      if (!response.ok || !payload.ok) {
        setWorkspaceError(payload.ok ? "新建问答失败，请稍后重试。" : payload.error.message);
        return;
      }
      setSessions((current) => [payload.data, ...current]);
      setSelectedId(payload.data.id);
    } catch {
      setWorkspaceError("新建问答失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function removeSession(id: string) {
    setWorkspaceError(null);
    try {
      const response = await fetch(`/api/agent/knowledge/sessions/${id}`, { method: "DELETE" });
      if (!response.ok) {
        setWorkspaceError("删除问答失败，请稍后重试。");
        return;
      }
      const remaining = sessions.filter((item) => item.id !== id);
      setSessions(remaining);
      if (selectedId === id) setSelectedId(remaining[0]?.id ?? null);
    } catch {
      setWorkspaceError("删除问答失败，请稍后重试。");
    }
  }

  const sessionList = (
      <div className="flex h-full min-h-0 flex-col bg-card/35">
        <div className="flex h-12 items-center justify-between border-b border-foreground/20 px-3">
          <h2 className="text-sm font-semibold">问答记录</h2>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => void createSession()} disabled={busy} aria-label="新建问答">
            <MessageSquarePlus className="size-4" />
          </Button>
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
          {sessions.map((session) => (
            <div key={session.id} className={cn("group flex min-w-52 items-center border", selectedId === session.id ? "border-primary bg-primary/5" : "border-foreground/15")}>
              <button type="button" onClick={() => { setSelectedId(session.id); setHistoryOpen(false); }} className="min-w-0 flex-1 px-3 py-2 text-left">
                <span className="block truncate text-sm font-medium">{session.title}</span>
                <span className="mt-0.5 block text-[0.65rem] text-muted-foreground">{new Date(session.updatedAt).toLocaleString("zh-CN")}</span>
              </button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => void removeSession(session.id)} aria-label={`删除${session.title}`}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          {sessions.length === 0 ? <p className="px-2 py-4 text-xs leading-5 text-muted-foreground">新建问答后，可以持续追问并保留历史记录。</p> : null}
        </div>
      </div>
  );

  const historyButton = (
    <Button type="button" variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
      <History data-icon="inline-start" />问答记录
    </Button>
  );

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] min-h-[34rem] flex-col overflow-hidden lg:h-[calc(100dvh-8rem)] lg:min-h-0">
      {workspaceError ? (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive" role="alert">
          {workspaceError}
        </div>
      ) : null}
      {selectedId ? (
        <KnowledgeChat key={`${selectedId}:${initialPrompt ?? ""}`} sessionId={selectedId} initialPrompt={initialPrompt} onSessionUpdated={() => void refreshSessions()} headerAction={historyButton} />
      ) : (
        <section className="grid min-h-[30rem] place-items-center border-y border-foreground/35 bg-card/35 p-6 text-center">
          <div>
            <BookOpenText className="mx-auto size-8 text-primary" />
            <h2 className="mt-3 font-semibold">新建课程知识问答</h2>
            <p className="mt-1 text-sm text-muted-foreground">回答会附上课程分P和视频时间位置。</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button onClick={() => void createSession()} disabled={busy}>
                {busy ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
                新建问答
              </Button>
              {historyButton}
            </div>
          </div>
        </section>
      )}
      <ResponsiveDrawer open={historyOpen} onOpenChange={setHistoryOpen} title="问答记录" description="选择一个会话继续追问。">
        {sessionList}
      </ResponsiveDrawer>
    </div>
  );
}
