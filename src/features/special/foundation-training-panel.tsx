"use client";

import { CheckCircle2, LoaderCircle, LockKeyhole, Play, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FoundationItem = {
  tagId: string;
  name: string;
  path: string;
  questionCount: number;
  trainable: boolean;
  status: string;
  roundCount: number;
  lastRoundCorrect: number | null;
  bestRoundCorrect: number | null;
};

type FoundationProgress = {
  totalCount: number;
  passedCount: number;
  trainingCount: number;
  insufficientCount: number;
  completed: boolean;
  current: FoundationItem | null;
  items: FoundationItem[];
};

type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { message: string } };

export function FoundationTrainingPanel({
  progress,
  initialTagId,
}: {
  progress: FoundationProgress;
  initialTagId?: string;
}) {
  const router = useRouter();
  const initial = progress.items.find((item) => item.tagId === initialTagId && item.trainable)
    ?? progress.current;
  const [selectedId, setSelectedId] = useState(initial?.tagId ?? "");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = progress.items.find((item) => item.tagId === selectedId) ?? progress.current;

  async function start() {
    if (!selected?.trainable) return;
    setIsPending(true);
    setError(null);
    try {
      const response = await fetch("/api/practice/sessions/special", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocol: "FOUNDATION", tagId: selected.tagId }),
      });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }
      router.push(`/practice/${payload.data.id}`);
    } catch {
      setError("创建筑基训练失败，请稍后重试。");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="border-y-2 border-foreground bg-card/35">
      <header className="grid gap-4 border-b border-foreground/25 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <div className="text-xs font-semibold tracking-[0.12em] text-primary">叶子题型筑基</div>
          <h2 className="student-heading mt-2 text-2xl font-semibold">每类15题，答对9题即通过</h2>
          <p className="mt-2 text-sm text-muted-foreground">系统按知识点顺序推进，优先抽取未做题和历史错题。</p>
        </div>
        <dl className="grid grid-cols-4 border border-foreground/25 text-center text-xs">
          {[
            ["可训练", progress.totalCount],
            ["已通过", progress.passedCount],
            ["训练中", progress.trainingCount],
            ["题库不足", progress.insufficientCount],
          ].map(([label, value]) => (
            <div key={label} className="border-r border-foreground/20 px-3 py-2 last:border-r-0">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="student-heading mt-1 text-lg font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {progress.completed ? (
        <div className="p-6">
          <Alert variant="success">
            <CheckCircle2 aria-hidden="true" />
            <AlertTitle>筑基成功</AlertTitle>
            <AlertDescription>所有可训练叶子类型的历史最佳成绩都已达到 9/15。</AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="max-h-[26rem] divide-y overflow-y-auto border-b lg:border-b-0 lg:border-r">
            {progress.items.map((item) => (
              <button
                key={item.tagId}
                type="button"
                disabled={!item.trainable}
                className={cn(
                  "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 disabled:cursor-default",
                  item.tagId === selected?.tagId && "bg-primary/8",
                  !item.trainable && "opacity-55"
                )}
                onClick={() => setSelectedId(item.tagId)}
              >
                <span className="grid size-8 shrink-0 place-items-center border">
                  {!item.trainable ? <LockKeyhole className="size-4" /> : item.status === "PASSED" ? <CheckCircle2 className="size-4 text-success" /> : <Target className="size-4 text-primary" />}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{item.path}</strong>
                  <small className="text-muted-foreground">
                    {item.questionCount}题 · {item.lastRoundCorrect === null ? "尚未训练" : `上轮 ${item.lastRoundCorrect}/15`} · 最佳 {item.bestRoundCorrect ?? 0}/15
                  </small>
                </span>
                <Badge variant={item.status === "PASSED" ? "success" : item.trainable ? "outline" : "warning"}>
                  {item.status === "PASSED" ? "已通过" : item.trainable ? "待训练" : "题库不足"}
                </Badge>
              </button>
            ))}
          </div>

          <aside className="p-5">
            {selected ? (
              <>
                <span className="text-xs text-muted-foreground">当前训练</span>
                <h3 className="student-heading mt-2 text-xl font-semibold">{selected.name}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">固定15题，至少答对9题。未通过时继续本类型，通过后进入下一个叶子。</p>
                <Button className="mt-6 h-12 w-full" disabled={isPending || !selected.trainable} onClick={start}>
                  {isPending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                  {selected.status === "TRAINING" ? "再练本类型15题" : "开始15题筑基"}
                </Button>
              </>
            ) : <p className="text-sm text-muted-foreground">当前没有可训练的叶子类型。</p>}
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          </aside>
        </div>
      )}
    </section>
  );
}
