"use client";

import {
  Bot,
  LoaderCircle,
  MessageSquare,
  PanelRight,
  RotateCcw,
  Send,
  Square,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type TutorReview = {
  mistakeCause: string;
  confidence: string;
  causeSummary: string;
  fastestPath: string;
  transferRule: string;
};

type TutorMessage = {
  id?: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt?: string;
  review?: TutorReview | null;
  streamKey?: string;
};

type TutorHistoryResponse = {
  messages: TutorMessage[];
  suggestedPrompts: string[];
};

type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { message: string } };

type TutorStreamEvent =
  | { type: "token"; content: string }
  | { type: "done"; messageId: string; suggestedPrompts: string[] }
  | { type: "review"; mistakeCause: string; confidence: string; causeSummary: string; fastestPath: string; transferRule: string }
  | { type: "error"; message: string };

type TutorPanelVariant = "dock" | "assistant";
type TutorPanelHeightMode = "content" | "fill";

const defaultPrompts = [
  "为什么不选我选的这个？",
  "有没有更快的做法？",
  "这题考哪个知识点？",
  "给我总结成一句口诀",
  "下次怎么识别同类题？",
];

const causeLabels: Record<string, string> = {
  READING_MISS: "审题漏条件",
  CONCEPT_GAP: "知识点不会",
  METHOD_GAP: "题型方法不会",
  OPTION_TRAP: "选项陷阱",
  CALCULATION_ERROR: "计算错误",
  MATERIAL_LOCATION_ERROR: "材料定位错误",
  LOGIC_CHAIN_BREAK: "推理链断裂",
  TIME_STRATEGY_ERROR: "时间策略失误",
  CARELESSNESS: "非知识性失误",
  UNKNOWN: "信息不足",
};

function TutorMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h3 className="mt-2 text-base font-semibold first:mt-0">{children}</h3>,
        h2: ({ children }) => <h3 className="mt-2 text-base font-semibold first:mt-0">{children}</h3>,
        h3: ({ children }) => <h4 className="mt-2 text-sm font-semibold first:mt-0">{children}</h4>,
        p: ({ children }) => <p className="text-sm leading-6">{children}</p>,
        ul: ({ children }) => <ul className="ml-4 list-disc text-sm leading-6">{children}</ul>,
        ol: ({ children }) => <ol className="ml-4 list-decimal text-sm leading-6">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        code: ({ children }) => <code className="rounded bg-background px-1 py-0.5 text-xs">{children}</code>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function parseTutorStreamEvent(rawEvent: string) {
  const eventType = rawEvent
    .split("\n")
    .find((line) => line.startsWith("event: "))
    ?.slice("event: ".length);
  const data = rawEvent
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice("data: ".length))
    .join("\n");

  if (!eventType || !data) {
    return null;
  }

  return JSON.parse(data) as TutorStreamEvent;
}

function TutorConversation({
  questionId,
  sessionId,
  contextLabel,
  compact = false,
  heightMode = "content",
  showHeader = true,
}: {
  questionId: string;
  sessionId?: string;
  contextLabel?: string;
  compact?: boolean;
  heightMode?: TutorPanelHeightMode;
  showHeader?: boolean;
}) {
  const [prompt, setPrompt] = useState(defaultPrompts[0]);
  const [suggestedPrompts, setSuggestedPrompts] = useState(defaultPrompts);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeStreamKeyRef = useRef<string | null>(null);
  const streamBufferRef = useRef("");
  const streamTimerRef = useRef<number | null>(null);
  const historyUrl = useMemo(() => {
    const params = new URLSearchParams();

    if (sessionId) {
      params.set("sessionId", sessionId);
    }

    const query = params.toString();
    return `/api/agent/tutor/questions/${questionId}${query ? `?${query}` : ""}`;
  }, [questionId, sessionId]);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setIsHistoryLoading(true);
      setError(null);
      setMessages([]);

      try {
        const response = await fetch(historyUrl);
        const payload = (await response.json()) as ApiResponse<TutorHistoryResponse>;

        if (cancelled) {
          return;
        }

        if (!payload.ok) {
          setError(payload.error.message);
          return;
        }

        setMessages(payload.data.messages);
        setSuggestedPrompts(payload.data.suggestedPrompts.length > 0 ? payload.data.suggestedPrompts : defaultPrompts);
        setPrompt(payload.data.suggestedPrompts[0] ?? defaultPrompts[0]);
      } catch {
        if (!cancelled) {
          setError("讲题历史暂时不可用，可以直接重新追问。");
        }
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [historyUrl]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
      if (streamTimerRef.current !== null) {
        window.clearTimeout(streamTimerRef.current);
      }
    },
    []
  );

  function clearStreamingTimer() {
    if (streamTimerRef.current !== null) {
      window.clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }

  function clearStreamingState() {
    activeStreamKeyRef.current = null;
    streamBufferRef.current = "";
    clearStreamingTimer();
  }

  function scheduleStreamingFlush() {
    if (streamTimerRef.current !== null) {
      return;
    }

    const tick = () => {
      const key = activeStreamKeyRef.current;
      const buffer = streamBufferRef.current;

      if (!key || buffer.length === 0) {
        streamTimerRef.current = null;
        return;
      }

      const chunkSize = buffer.length > 180 ? 18 : buffer.length > 90 ? 10 : buffer.length > 36 ? 6 : 2;
      const delay = buffer.length > 180 ? 8 : buffer.length > 90 ? 12 : buffer.length > 36 ? 18 : 28;
      const nextChunk = buffer.slice(0, chunkSize);
      streamBufferRef.current = buffer.slice(chunkSize);

      setMessages((current) =>
        current.map((message) =>
          message.streamKey === key ? { ...message, content: message.content + nextChunk } : message
        )
      );

      streamTimerRef.current = window.setTimeout(() => {
        streamTimerRef.current = null;
        tick();
      }, delay);
    };

    tick();
  }

  function stopStreaming() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    clearStreamingState();
    setIsLoading(false);
  }

  async function askTutor(nextPrompt = prompt) {
    const trimmed = nextPrompt.trim();

    if (!trimmed || isLoading) {
      return;
    }

    const controller = new AbortController();
    const streamKey = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;
    activeStreamKeyRef.current = streamKey;
    streamBufferRef.current = "";
    clearStreamingTimer();

    setIsLoading(true);
    setError(null);
    setMessages((current) => [
      ...current,
      { role: "USER", content: trimmed },
      { role: "ASSISTANT", content: "", review: null, streamKey },
    ]);

    try {
      const response = await fetch(`/api/agent/tutor/questions/${questionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        signal: controller.signal,
        body: JSON.stringify({
          sessionId,
          prompt: trimmed,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json()) as ApiResponse<never>;
        setError(payload.ok ? "讲题助教暂时不可用，请稍后重试。" : payload.error.message);
        setLastFailedPrompt(trimmed);
        setMessages((current) => current.slice(0, -1));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const rawEvent of events) {
          const event = parseTutorStreamEvent(rawEvent);

          if (!event) {
            continue;
          }

          if (event.type === "token") {
            streamBufferRef.current += event.content;
            scheduleStreamingFlush();
          }

          if (event.type === "review") {
            setMessages((current) => {
              const next = [...current];
              const index = next.findLastIndex((message) => message.role === "ASSISTANT" && message.streamKey === streamKey);

              if (index >= 0) {
                next[index] = { ...next[index], review: event };
              }

              return next;
            });
          }

          if (event.type === "done") {
            while (streamBufferRef.current.length > 0) {
              await new Promise((resolve) => window.setTimeout(resolve, 12));
            }

            setSuggestedPrompts(event.suggestedPrompts.length > 0 ? event.suggestedPrompts : defaultPrompts);
            setMessages((current) => {
              const next = [...current];
              const index = next.findLastIndex((message) => message.role === "ASSISTANT" && message.streamKey === streamKey);

              if (index >= 0) {
                next[index] = { ...next[index], id: event.messageId, streamKey: undefined };
              }

              return next;
            });
            clearStreamingState();
          }

          if (event.type === "error") {
            setError(event.message);
            setLastFailedPrompt(trimmed);
            clearStreamingState();
            return;
          }
        }

        if (done) {
          break;
        }
      }

      setPrompt("");
      setLastFailedPrompt(null);
    } catch {
      if (controller.signal.aborted) {
        return;
      }

      setError("讲题助教暂时不可用，请稍后重试。");
      setLastFailedPrompt(trimmed);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }

  return (
    <div className={cn("flex min-h-0 flex-col", compact ? "text-sm" : "", heightMode === "fill" && "h-full overflow-hidden")}>
      {showHeader ? (
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-foreground text-background">
            <Bot className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-5">讲题助教</div>
            {contextLabel ? <div className="truncate text-xs text-muted-foreground">{contextLabel}</div> : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="mx-3 mt-3">
          <AlertTitle>助教暂时不可用</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{error}</span>
            {lastFailedPrompt ? (
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => askTutor(lastFailedPrompt)}>
                <RotateCcw data-icon="inline-start" />
                重试
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div
        className={cn(
          "flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-2.5",
          heightMode === "fill" ? "min-h-0" : "min-h-48",
          heightMode === "content" && (compact ? "max-h-80" : "max-h-[46dvh]")
        )}
        role="log"
        aria-live="polite"
      >
        {isHistoryLoading ? (
          <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" aria-hidden="true" />
            读取记录
          </div>
        ) : messages.length > 0 ? (
          messages.map((message, index) => (
            <div
              key={`${message.id ?? "draft"}-${message.role}-${index}`}
              className={cn("flex flex-col gap-2 rounded-lg border px-3 py-2.5 shadow-xs", message.role === "ASSISTANT" ? "bg-card" : "ml-8 bg-primary/10")}
            >
              {message.role === "ASSISTANT" ? (
                message.content ? (
                  <div className="flex flex-col gap-2">
                    {message.review ? (
                      <div className="grid gap-2 rounded-md border bg-background p-2.5 sm:grid-cols-3">
                        <div>
                          <div className="text-[11px] text-muted-foreground">错因</div>
                          <div className="mt-0.5 text-sm font-medium">{causeLabels[message.review.mistakeCause] ?? message.review.mistakeCause}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-muted-foreground">路径</div>
                          <div className="mt-0.5 line-clamp-2 text-sm leading-5">{message.review.fastestPath}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-muted-foreground">规则</div>
                          <div className="mt-0.5 line-clamp-2 text-sm leading-5">{message.review.transferRule}</div>
                        </div>
                      </div>
                    ) : null}
                    <div className="rounded-md bg-background/60 p-2.5">
                      <TutorMarkdown content={message.content} />
                      {isLoading &&
                      index === messages.length - 1 &&
                      message.role === "ASSISTANT" &&
                      message.content ? (
                        <span aria-hidden="true" className="ml-1 inline-block h-4 w-1 animate-pulse rounded-full bg-primary align-middle" />
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                    讲解中
                  </div>
                )
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
              )}
            </div>
          ))
        ) : (
          <div className="grid flex-1 place-items-center rounded-lg border border-dashed bg-background/70 p-4 text-center text-sm text-muted-foreground">
            选一个快捷问题开始
          </div>
        )}
        {isLoading && messages[messages.length - 1]?.content ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" aria-hidden="true" />
            讲解中
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 gap-1.5 overflow-x-auto border-t px-2.5 py-1.5">
        {suggestedPrompts.slice(0, 3).map((item) => (
          <Button key={item} type="button" variant="outline" size="sm" className="h-7 rounded-md px-2 text-xs" disabled={isLoading} onClick={() => askTutor(item)}>
            {item}
          </Button>
        ))}
      </div>

      <label className="shrink-0 border-t bg-muted/35 p-2.5">
        <span className="sr-only">继续追问</span>
        <div className="flex min-h-11 items-center gap-2 rounded-lg border border-input bg-card px-2 py-1.5 shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="max-h-20 min-h-8 flex-1 resize-none bg-transparent px-1 py-1 text-base leading-6 outline-none md:text-sm"
            placeholder="继续追问..."
            disabled={isLoading}
          />
          <Button
            type="button"
            size="icon-sm"
            className="size-8 shrink-0 rounded-full"
            aria-label={isLoading ? "停止" : "发送"}
            disabled={!isLoading && prompt.trim().length === 0}
            onClick={() => (isLoading ? stopStreaming() : askTutor())}
          >
            {isLoading ? <Square data-icon="icon" /> : <Send data-icon="icon" />}
          </Button>
        </div>
      </label>
    </div>
  );
}

export function TutorPanel({
  questionId,
  sessionId,
  className,
  variant = "assistant",
  triggerLabel = "问助教",
  contextLabel,
  heightMode = "content",
}: {
  questionId: string;
  sessionId?: string;
  className?: string;
  variant?: TutorPanelVariant;
  triggerLabel?: string;
  contextLabel?: string;
  heightMode?: TutorPanelHeightMode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (variant === "dock") {
    return (
      <section
        className={cn(
          "min-h-0 overflow-hidden border bg-card shadow-xs",
          heightMode === "fill" ? "flex h-full flex-col" : "rounded-lg",
          className
        )}
      >
        <div className="flex h-8 shrink-0 items-center gap-2 border-b bg-muted/45 px-3">
          <PanelRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <div className="text-xs font-medium text-muted-foreground">讲题助教</div>
        </div>
        <TutorConversation questionId={questionId} sessionId={sessionId} contextLabel={contextLabel} heightMode={heightMode} showHeader={false} />
      </section>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setIsOpen(true)}>
        <MessageSquare data-icon="inline-start" />
        {triggerLabel}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent variant="assistant" className="flex flex-col p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>讲题助教</DialogTitle>
            <DialogDescription>讲题助教对话面板。</DialogDescription>
          </DialogHeader>
          <DialogBody className="min-h-0 flex-1 overflow-hidden p-2">
            <TutorConversation questionId={questionId} sessionId={sessionId} contextLabel={contextLabel} compact />
          </DialogBody>
          <DialogFooter className="sr-only">
            <DialogClose>收起助教</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
