"use client";

import { Clock3, LoaderCircle, Play } from "lucide-react";
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

export function PaperStartButton({
  paperId,
  className,
  variant = "default",
  purpose = "PRACTICE",
  durationSeconds,
}: {
  paperId: string;
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

  async function startPractice() {
    if (timed && (minutes < 10 || minutes > 300)) {
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
          mode: "PAPER",
          purpose,
          timingMode: timed ? timingMode : "UNTYPED",
          timeLimitSeconds: timed ? minutes * 60 : null,
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

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={variant}
        className={className}
        disabled={isPending}
        onClick={() => timed ? setDialogOpen(true) : void startPractice()}
      >
        {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : timed ? <Clock3 data-icon="inline-start" /> : <Play data-icon="inline-start" />}
        {isPending ? "正在创建" : purpose === "BASELINE" ? "开始 benchmark" : purpose === "MOCK" ? "开始限时模拟" : purpose === "TIME_PRESSURE" ? "开始减时模拟" : "开始练习"}
      </Button>
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{purpose === "BASELINE" ? "设置基准测试" : "设置限时练习"}</DialogTitle>
            <DialogDescription>严格模拟不开放暂停；普通限时会记录暂停次数与暂停时长。</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={timingMode === "STRICT" ? "default" : "outline"} onClick={() => setTimingMode("STRICT")}>严格模拟</Button>
              <Button type="button" variant={timingMode === "FLEXIBLE" ? "default" : "outline"} onClick={() => setTimingMode("FLEXIBLE")}>普通限时</Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`paper-minutes-${paperId}`}>本次时长（分钟）</Label>
              <Input id={`paper-minutes-${paperId}`} type="number" min={10} max={300} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
            </div>
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button type="button" disabled={isPending} onClick={() => void startPractice()}>
              {isPending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Play data-icon="inline-start" />}
              开始答题
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
