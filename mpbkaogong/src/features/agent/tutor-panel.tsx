"use client";

import { Bot, LoaderCircle, MessageSquare, RotateCcw, Send } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TutorMessage = {
  role: "USER" | "ASSISTANT";
  content: string;
};

type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { message: string } };

const defaultPrompts = [
  "为什么不选我选的这个？",
  "有没有更快的做法？",
  "这题考哪个知识点？",
  "给我总结成一句口诀",
  "下次怎么识别同类题？",
];

export function TutorPanel({
  questionId,
  sessionId,
  className,
}: {
  questionId: string;
  sessionId?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState(defaultPrompts[0]);
  const [suggestedPrompts, setSuggestedPrompts] = useState(defaultPrompts);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  async function askTutor(nextPrompt = prompt) {
    const trimmed = nextPrompt.trim();

    if (!trimmed) {
      return;
    }

    setIsOpen(true);
    setIsLoading(true);
    setError(null);
    setMessages((current) => [...current, { role: "USER", content: trimmed }]);

    try {
      const response = await fetch(`/api/agent/tutor/questions/${questionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          prompt: trimmed,
        }),
      });
      const payload = (await response.json()) as ApiResponse<{
        answer: string;
        suggestedPrompts: string[];
      }>;

      if (!payload.ok) {
        setError(payload.error.message);
        setLastFailedPrompt(trimmed);
        return;
      }

      setMessages((current) => [...current, { role: "ASSISTANT", content: payload.data.answer }]);
      setSuggestedPrompts(payload.data.suggestedPrompts.length > 0 ? payload.data.suggestedPrompts : defaultPrompts);
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
    <div className={cn("flex flex-col gap-3", className)}>
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setIsOpen((value) => !value)}>
        <MessageSquare data-icon="inline-start" />
        {isOpen ? "收起助教" : "问助教"}
      </Button>

      {isOpen ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot aria-hidden="true" />
              讲题助教
            </CardTitle>
            <CardDescription>围绕当前题、官方答案和我的作答追问，适合复盘时使用。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>助教没有回答</AlertTitle>
                <AlertDescription className="flex flex-col gap-3">
                  <span>{error}</span>
                  {lastFailedPrompt ? (
                    <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => askTutor(lastFailedPrompt)}>
                      <RotateCcw data-icon="inline-start" />
                      重试刚才的问题
                    </Button>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}

            {messages.length > 0 ? (
              <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-lg border bg-background p-3" role="log" aria-live="polite">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={cn(
                      "flex flex-col gap-1 rounded-lg px-3 py-2",
                      message.role === "ASSISTANT" ? "bg-secondary" : "bg-muted"
                    )}
                  >
                    <Badge variant={message.role === "ASSISTANT" ? "info" : "outline"} className="w-fit">
                      {message.role === "ASSISTANT" ? "助教" : "我"}
                    </Badge>
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  </div>
                ))}
                {isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                    正在讲解
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {suggestedPrompts.map((item) => (
                <Button key={item} type="button" variant="outline" size="sm" onClick={() => askTutor(item)}>
                  {item}
                </Button>
              ))}
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">继续追问</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="min-h-24 rounded-lg border border-input bg-card px-3 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                placeholder="例如：这题最快怎么排除两个选项？"
              />
            </label>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="button" disabled={isLoading || prompt.trim().length === 0} onClick={() => askTutor()}>
              {isLoading ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Send data-icon="inline-start" />}
              发送
            </Button>
          </CardFooter>
        </Card>
      ) : null}
    </div>
  );
}
