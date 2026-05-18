"use client";

import {
  Bot,
  LoaderCircle,
  MessageSquare,
  PanelRight,
  RotateCcw,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

  async function askTutor(nextPrompt = prompt) {
    const trimmed = nextPrompt.trim();

    if (!trimmed || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessages((current) => [
      ...current,
      { role: "USER", content: trimmed },
      { role: "ASSISTANT", content: "", review: null },
    ]);

    try {
      const response = await fetch(`/api/agent/tutor/questions/${questionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
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
            setMessages((current) => {
              const next = [...current];
              const lastMessage = next[next.length - 1];

              if (lastMessage?.role === "ASSISTANT") {
                next[next.length - 1] = { ...lastMessage, content: lastMessage.content + event.content };
              }

              return next;
            });
          }

          if (event.type === "review") {
            setMessages((current) => {
              const next = [...current];
              const lastMessage = next[next.length - 1];

              if (lastMessage?.role === "ASSISTANT") {
                next[next.length - 1] = { ...lastMessage, review: event };
              }

              return next;
            });
          }

          if (event.type === "done") {
            setSuggestedPrompts(event.suggestedPrompts.length > 0 ? event.suggestedPrompts : defaultPrompts);
            setMessages((current) => {
              const next = [...current];
              const lastMessage = next[next.length - 1];

              if (lastMessage?.role === "ASSISTANT") {
                next[next.length - 1] = { ...lastMessage, id: event.messageId };
              }

              return next;
            });
          }

          if (event.type === "error") {
            setError(event.message);
            setLastFailedPrompt(trimmed);
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
      setError("讲题助教暂时不可用，请稍后重试。");
      setLastFailedPrompt(trimmed);
    } finally {
      setIsLoading(false);
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

      <div className="flex shrink-0 gap-1.5 overflow-x-auto border-t px-3 py-2">
        {suggestedPrompts.slice(0, 3).map((item) => (
          <Button key={item} type="button" variant="outline" size="sm" className="h-8 rounded-md px-2 text-xs" disabled={isLoading} onClick={() => askTutor(item)}>
            {item}
          </Button>
        ))}
      </div>

      <label className="flex shrink-0 flex-col gap-2 border-t bg-muted/35 px-3 py-2.5">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="min-h-16 resize-none rounded-md border border-input bg-card px-3 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          placeholder="例如：这题最快怎么排除两个选项？"
          disabled={isLoading}
        />
        <Button type="button" className="self-end h-8 px-3 text-xs" disabled={isLoading || prompt.trim().length === 0} onClick={() => askTutor()}>
          {isLoading ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Send data-icon="inline-start" />}
          发送
        </Button>
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
