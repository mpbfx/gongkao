"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { BookOpenText, Bot, LoaderCircle, MessageSquare, PanelRight, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
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
import {
  prepareTutorRequest,
  type TutorHistoryResponse,
  type TutorRequestMode,
  type TutorUIMessage,
} from "@/features/agent/tutor-ui-message";
import { normalizeLatexDelimiters } from "@/lib/markdown/normalize-latex";
import { cn } from "@/lib/utils";

type TutorPanelVariant = "dock" | "assistant";
type TutorPanelHeightMode = "content" | "fill";

type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { message: string } };

const defaultPrompts = [
  "为什么不选我选的这个？",
  "有没有更快的做法？",
  "这题考哪个知识点？",
];

function TutorMessageList({ messages, streaming }: { messages: TutorUIMessage[]; streaming: boolean }) {
  return messages.map((message, messageIndex) => (
    <Message from={message.role} key={message.id}>
      <MessageContent>
        {message.parts.map((part, partIndex) => {
          if (part.type === "text") {
            return message.role === "assistant" ? (
              <MessageResponse
                isAnimating={streaming && messageIndex === messages.length - 1}
                key={`${message.id}-text-${partIndex}`}
              >
                {normalizeLatexDelimiters(part.text)}
              </MessageResponse>
            ) : (
              <p className="whitespace-pre-wrap leading-6" key={`${message.id}-text-${partIndex}`}>
                {part.text}
              </p>
            );
          }
          return null;
        })}
      </MessageContent>
    </Message>
  ));
}

function TutorActivity({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground" role="status">
      <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function TutorChat({
  questionId,
  sessionId,
  contextLabel,
  compact,
  heightMode,
  showHeader,
}: {
  questionId: string;
  sessionId?: string;
  contextLabel?: string;
  compact: boolean;
  heightMode: TutorPanelHeightMode;
  showHeader: boolean;
}) {
  const historyUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (sessionId) params.set("sessionId", sessionId);
    const query = params.toString();
    return `/api/agent/tutor/questions/${questionId}${query ? `?${query}` : ""}`;
  }, [questionId, sessionId]);
  const [mode, setMode] = useState<TutorRequestMode>("chat");
  const transport = useMemo(
    () =>
      new DefaultChatTransport<TutorUIMessage>({
        api: `/api/agent/tutor/questions/${questionId}`,
        prepareSendMessagesRequest: ({ messages, trigger }) => ({
          body: prepareTutorRequest({
            messages,
            operation: trigger === "regenerate-message" ? "regenerate" : "submit",
            sessionId,
            mode,
          }),
        }),
      }),
    [mode, questionId, sessionId]
  );
  const [prompt, setPrompt] = useState("");
  const [suggestedPrompts, setSuggestedPrompts] = useState(defaultPrompts);
  const [activity, setActivity] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const {
    messages,
    setMessages,
    sendMessage,
    regenerate,
    stop,
    status,
    error,
    clearError,
  } = useChat<TutorUIMessage>({
    id: `${questionId}:${sessionId ?? "question"}`,
    transport,
    experimental_throttle: 40,
    onData(part) {
      if (part.type === "data-activity") setActivity(part.data.label);
      if (part.type === "data-suggestions") setSuggestedPrompts(part.data.items);
    },
    onFinish() {
      setActivity(null);
    },
    onError() {
      setActivity(null);
    },
  });
  const isGenerating = status === "submitted" || status === "streaming";
  const stopRef = useRef(stop);

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      try {
        const response = await fetch(historyUrl, { signal: controller.signal });
        const payload = (await response.json()) as ApiResponse<TutorHistoryResponse>;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.ok ? "讲题历史暂时不可用。" : payload.error.message);
        }
        setMessages(payload.data.messages);
        if (payload.data.suggestedPrompts.length > 0) {
          setSuggestedPrompts(payload.data.suggestedPrompts);
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setHistoryError(loadError instanceof Error ? loadError.message : "讲题历史暂时不可用，可以直接重新追问。");
        }
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    }

    void loadHistory();
    return () => {
      controller.abort();
      // Avoid depending on `stop` identity — unstable refs re-run this effect mid-stream.
      void stopRef.current();
    };
  }, [historyUrl, setMessages]);

  async function submit(text: string) {
    const nextPrompt = text.trim();
    if (!nextPrompt || isGenerating) return;
    clearError();
    setHistoryError(null);
    setActivity(mode === "knowledge" ? "正在检索课程知识" : "正在理解你的问题");
    setPrompt("");
    await sendMessage({ text: nextPrompt });
    setMode("chat");
  }

  async function stopGeneration() {
    await stop();
    setActivity(null);
    setMessages((current) => {
      const last = current.at(-1);
      return last?.role === "assistant" && !last.metadata?.persistedMessageId ? current.slice(0, -1) : current;
    });
  }

  async function retry() {
    clearError();
    setActivity("正在重新生成讲解");
    await regenerate();
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        compact && "text-sm",
        heightMode === "fill" && "flex-1 overflow-hidden"
      )}
    >
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

      {historyError || error ? (
        <Alert variant="destructive" className="mx-3 mt-3 shrink-0" aria-live="assertive">
          <AlertTitle>助教暂时不可用</AlertTitle>
          <AlertDescription className="flex items-start justify-between gap-2">
            <span>{error?.message || historyError}</span>
            {error ? (
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void retry()}>
                <RotateCcw data-icon="inline-start" />
                重试
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <Conversation
        className={cn(
          heightMode === "fill" ? "min-h-0" : "min-h-48",
          heightMode === "content" && (compact ? "max-h-80" : "max-h-[46dvh]")
        )}
      >
        <ConversationContent>
          {historyLoading ? (
            <TutorActivity label="正在读取历史记录" />
          ) : messages.length > 0 ? (
            <TutorMessageList messages={messages} streaming={status === "streaming"} />
          ) : (
            <ConversationEmptyState title="从一个问题开始" description="助教会结合本题和你的错题记录讲解。" />
          )}
          {isGenerating ? <TutorActivity label={activity ?? (status === "submitted" ? "正在理解你的问题" : "正在讲解")} /> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {mode === "chat" ? (
        <div className="shrink-0 border-t px-2.5 py-1.5">
          <Suggestions>
            {suggestedPrompts.slice(0, 3).map((item) => (
              <Suggestion
                disabled={isGenerating}
                key={item}
                suggestion={item}
                onClick={(suggestion) => void submit(suggestion)}
              />
            ))}
          </Suggestions>
        </div>
      ) : null}

      <div className="shrink-0 border-t bg-muted/25 p-2.5">
        <div className="mb-2 flex items-center gap-1" aria-label="助教回答模式">
          <Button
            type="button"
            variant={mode === "chat" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={mode === "chat"}
            disabled={isGenerating}
            onClick={() => setMode("chat")}
          >
            <MessageSquare data-icon="inline-start" />
            讲解本题
          </Button>
          <Button
            type="button"
            variant={mode === "knowledge" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={mode === "knowledge"}
            disabled={isGenerating}
            onClick={() => setMode("knowledge")}
          >
            <BookOpenText data-icon="inline-start" />
            课程库
          </Button>
        </div>
        <PromptInput onSubmit={({ text }) => submit(text)}>
          <PromptInputBody>
            <PromptInputTextarea
              value={prompt}
              disabled={isGenerating}
              onChange={(event) => setPrompt(event.target.value)}
              aria-label="继续追问"
              placeholder={mode === "knowledge" ? "输入要检索的课程知识" : "继续追问这道题"}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputSubmit
              status={status}
              disabled={!isGenerating && prompt.trim().length === 0}
              onStop={() => void stopGeneration()}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

function TutorConversation(props: Omit<Parameters<typeof TutorChat>[0], "compact" | "showHeader"> & {
  compact?: boolean;
  showHeader?: boolean;
}) {
  const chatKey = `${props.questionId}:${props.sessionId ?? "question"}`;
  return <TutorChat key={chatKey} compact={false} showHeader {...props} />;
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
        <TutorConversation
          questionId={questionId}
          sessionId={sessionId}
          contextLabel={contextLabel}
          heightMode={heightMode}
          showHeader={false}
        />
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
            <TutorConversation
              questionId={questionId}
              sessionId={sessionId}
              contextLabel={contextLabel}
              compact
              heightMode="fill"
            />
          </DialogBody>
          <DialogFooter className="sr-only">
            <DialogClose>收起助教</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
