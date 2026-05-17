"use client";

import { LoaderCircle, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type ApiResponse<T> =
  | {
      ok: true;
      data: T;
      error: null;
    }
  | {
      ok: false;
      data: null;
      error: {
        code: string;
        message: string;
        details: unknown;
      };
    };

type CreateSessionResponse = {
  id: string;
};

export function PaperStartButton({
  paperId,
  className,
  variant = "default",
}: {
  paperId: string;
  className?: string;
  variant?: "default" | "outline" | "secondary";
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function startPractice() {
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/practice/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paperId, mode: "PAPER" }),
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
      setErrorMessage("创建练习失败，请稍后重试。");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant={variant} className={className} disabled={isPending} onClick={startPractice}>
        {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Play data-icon="inline-start" />}
        {isPending ? "正在创建" : "开始练习"}
      </Button>
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
    </div>
  );
}
