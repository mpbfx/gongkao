"use client";

import { ArrowRight, LoaderCircle, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | {
      ok: false;
      data: null;
      error: { code: string; message: string; details: unknown };
    };

type DailyPracticeInfo = {
  id: string;
  date: string;
  requestedDate: string;
  title: string;
  questionCount: number;
  isFallback: boolean;
  completedSession: {
    id: string;
    submittedAt: string | null;
    accuracy: string;
  } | null;
};

type CreateSessionResponse = {
  id: string;
};

export function DailyPracticeAction({
  dailyPractice,
  className,
}: {
  dailyPractice: DailyPracticeInfo | null;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!dailyPractice) {
    return (
      <Button type="button" variant="outline" disabled className={className}>
        暂无每日一练
      </Button>
    );
  }

  if (dailyPractice.completedSession) {
    return (
      <Link
        href={`/practice/${dailyPractice.completedSession.id}?review=1`}
        className={cn(buttonVariants({ variant: "outline" }), className)}
      >
        查看今日记录
        <ArrowRight data-icon="inline-end" />
      </Link>
    );
  }

  async function startDailyPractice() {
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/practice/sessions/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dailyPractice?.date }),
      });
      const payload = (await response.json()) as ApiResponse<CreateSessionResponse>;

      if (!payload.ok) {
        if (payload.error.code === "UNAUTHORIZED") {
          router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
          return;
        }

        setErrorMessage(payload.error.message);
        return;
      }

      router.push(`/practice/${payload.data.id}`);
    } catch {
      setErrorMessage("创建每日一练失败，请稍后重试。");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" className={className} disabled={isPending} onClick={startDailyPractice}>
        {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Play data-icon="inline-start" />}
        {isPending ? "正在创建" : "开始每日一练"}
      </Button>
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
    </div>
  );
}

export type { DailyPracticeInfo };
