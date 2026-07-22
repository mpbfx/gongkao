"use client";

import { Clock3, Eye, LoaderCircle, Play, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { code: string; message: string; details: unknown } };

type CreateSessionResponse = { id: string };
type PaperPurpose = "PRACTICE" | "BASELINE" | "MOCK" | "TIME_PRESSURE";

function PaperTimingDialog({
  open,
  onOpenChange,
  paperId,
  purpose,
  timingMode,
  onTimingModeChange,
  minutes,
  onMinutesChange,
  errorMessage,
  isPending,
  onStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paperId: string;
  purpose: PaperPurpose;
  timingMode: "STRICT" | "FLEXIBLE";
  onTimingModeChange: (mode: "STRICT" | "FLEXIBLE") => void;
  minutes: number;
  onMinutesChange: (minutes: number) => void;
  errorMessage: string | null;
  isPending: boolean;
  onStart: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{purpose === "BASELINE" ? "设置基准测试" : "设置限时练习"}</DialogTitle>
          <DialogDescription>严格模拟不开放暂停；普通限时会记录暂停次数与暂停时长。</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={timingMode === "STRICT" ? "default" : "outline"} onClick={() => onTimingModeChange("STRICT")}>严格模拟</Button>
            <Button type="button" variant={timingMode === "FLEXIBLE" ? "default" : "outline"} onClick={() => onTimingModeChange("FLEXIBLE")}>普通限时</Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`paper-minutes-${paperId}`}>本次时长（分钟）</Label>
            <Input id={`paper-minutes-${paperId}`} type="number" min={10} max={300} value={minutes} onChange={(event) => onMinutesChange(Number(event.target.value))} />
          </div>
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button type="button" disabled={isPending} onClick={onStart}>
            {isPending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Play data-icon="inline-start" />}
            开始答题
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PaperStartButton({
  paperId,
  activeSession,
  submittedSession,
  className,
  variant = "default",
  purpose = "PRACTICE",
  durationSeconds,
}: {
  paperId: string;
  activeSession?: {
    id: string;
    answeredCount: number;
    totalCount: number;
    elapsedSeconds: number;
  } | null;
  submittedSession?: {
    id: string;
    answeredCount: number;
    totalCount: number;
  } | null;
  className?: string;
  variant?: "default" | "outline" | "secondary";
  purpose?: PaperPurpose;
  durationSeconds?: number | null;
}) {
  const router = useRouter();
  const timed = purpose !== "PRACTICE";
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [timingMode, setTimingMode] = useState<"STRICT" | "FLEXIBLE">("STRICT");
  const [minutes, setMinutes] = useState(
    Math.max(10, Math.round((durationSeconds ?? 7200) / 60) - (purpose === "TIME_PRESSURE" ? 10 : 0))
  );

  async function startPractice(continueFromSessionId?: string) {
    if (activeSession) {
      router.push(`/practice/${activeSession.id}`);
      return;
    }

    if (!continueFromSessionId && timed && (minutes < 10 || minutes > 300)) {
      setErrorMessage("练习时长需要在10到300分钟之间。");
      return;
    }
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/practice/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperId,
          continueFromSessionId,
          mode: "PAPER",
          purpose: continueFromSessionId ? "PRACTICE" : purpose,
          timingMode: continueFromSessionId ? "UNTYPED" : timed ? timingMode : "UNTYPED",
          timeLimitSeconds: continueFromSessionId ? null : timed ? minutes * 60 : null,
        }),
      });
      const payload = (await response.json()) as ApiResponse<CreateSessionResponse>;
      if (!payload.ok) {
        if (payload.error.code === "UNAUTHORIZED") {
          router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
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

  function startAgain() {
    if (timed) {
      setDialogOpen(true);
      return;
    }

    void startPractice();
  }

  if (submittedSession && !activeSession) {
    const isComplete = submittedSession.answeredCount >= submittedSession.totalCount;

    return (
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
        <Button
          type="button"
          className={className}
          disabled={isPending}
          onClick={() =>
            isComplete
              ? router.push(`/practice/${submittedSession.id}?review=1`)
              : void startPractice(submittedSession.id)
          }
        >
          {isPending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : isComplete ? (
            <Eye data-icon="inline-start" />
          ) : (
            <Play data-icon="inline-start" />
          )}
          {isPending ? "正在恢复" : isComplete ? "查看结果" : "继续作答"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={className}
          disabled={isPending}
          onClick={() =>
            isComplete
              ? startAgain()
              : router.push(`/practice/${submittedSession.id}?review=1`)
          }
        >
          {isPending && isComplete ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : isComplete ? (
            <RotateCcw data-icon="inline-start" />
          ) : (
            <Eye data-icon="inline-start" />
          )}
          {isPending && isComplete ? "正在创建" : isComplete ? "再练一次" : "查看上次结果"}
        </Button>
        <p className="col-span-2 text-xs text-muted-foreground lg:col-span-1 lg:text-right">
          {isComplete ? "已完成" : "上次已提交"} {submittedSession.answeredCount}/
          {submittedSession.totalCount}
        </p>

        <PaperTimingDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          paperId={paperId}
          purpose={purpose}
          timingMode={timingMode}
          onTimingModeChange={setTimingMode}
          minutes={minutes}
          onMinutesChange={setMinutes}
          errorMessage={errorMessage}
          isPending={isPending}
          onStart={() => void startPractice()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={variant}
        className={className}
        disabled={isPending}
        onClick={() => activeSession ? void startPractice() : timed ? setDialogOpen(true) : void startPractice()}
      >
        {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : timed ? <Clock3 data-icon="inline-start" /> : <Play data-icon="inline-start" />}
        {isPending ? "正在创建" : activeSession ? "继续作答" : purpose === "BASELINE" ? "开始 benchmark" : purpose === "MOCK" ? "开始限时模拟" : purpose === "TIME_PRESSURE" ? "开始减时模拟" : "开始练习"}
      </Button>
      {activeSession ? (
        <p className="text-xs text-muted-foreground lg:text-right">
          已答 {activeSession.answeredCount}/{activeSession.totalCount}
        </p>
      ) : null}
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      <PaperTimingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        paperId={paperId}
        purpose={purpose}
        timingMode={timingMode}
        onTimingModeChange={setTimingMode}
        minutes={minutes}
        onMinutesChange={setMinutes}
        errorMessage={errorMessage}
        isPending={isPending}
        onStart={() => void startPractice()}
      />
    </div>
  );
}
