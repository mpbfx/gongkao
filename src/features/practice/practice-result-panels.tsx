import { Check, Minus, X } from "lucide-react";

import { RichHtml } from "@/components/question/rich-html";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PracticeResultSummary = {
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  accuracy: string | null;
  elapsedSeconds: number;
  score?: string | null;
  maxScore?: string | null;
};

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}小时${minutes}分`;
  }

  return `${minutes}分${remainingSeconds}秒`;
}

export function PracticeResultOverview({
  summary,
  reviewMode,
  currentIndex = 0,
  totalCount,
  className,
}: {
  summary: PracticeResultSummary;
  reviewMode: boolean;
  currentIndex?: number;
  totalCount?: number;
  className?: string;
}) {
  return (
    <section className={cn("practice-result-overview flex min-h-14 shrink-0 flex-wrap items-center border-b border-foreground/25 bg-[#f8f4eb] px-4 text-sm lg:h-14 lg:flex-nowrap lg:px-6", className)}>
      <div className="flex min-w-48 items-center gap-3 border-r border-foreground/20 pr-5">
        <span className={cn("size-2 rounded-full", reviewMode ? "bg-success" : "bg-primary")} />
        <span className="font-semibold">{reviewMode ? "历史回看" : "提交完成"}</span>
        {totalCount ? <span className="font-mono text-muted-foreground">第 {currentIndex + 1} / {totalCount} 题</span> : null}
      </div>
      <dl className="flex min-w-0 flex-1 items-center overflow-x-auto">
        {[
          ...(summary.maxScore ? [["得分", `${summary.score ?? "0"}/${summary.maxScore}`, "text-primary"]] : []),
          ["正确率", `${summary.accuracy ?? "0.00"}%`, "text-primary"],
          ["正确", String(summary.correctCount), "text-success"],
          ["错误", String(summary.wrongCount), "text-destructive"],
          ["未答", String(summary.unansweredCount), "text-foreground"],
          ["用时", formatDuration(summary.elapsedSeconds), "text-foreground"],
        ].map(([label, value, tone]) => (
          <div key={label} className="flex h-8 min-w-28 items-baseline justify-center gap-3 border-r border-foreground/18 px-4 last:border-r-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={cn("student-heading text-lg font-semibold tabular-nums", tone)}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function PracticeResultAnalysisPanel({
  isMemorizeMode,
  isCorrect,
  answer,
  correctAnswer,
  analysisHtml,
  className,
}: {
  isMemorizeMode: boolean;
  isCorrect: boolean | null | undefined;
  answer: string | null | undefined;
  correctAnswer: string;
  analysisHtml?: string | null;
  className?: string;
}) {
  const isPositive = isMemorizeMode || isCorrect === true;
  const isUnanswered = !isMemorizeMode && !(answer ?? "").trim();

  return (
    <Card className={cn("practice-analysis-panel min-w-0", className)}>
      <CardContent className="flex flex-col gap-5 pt-1">
        <div
          className={cn(
            "border-y border-current/25 px-1 py-3",
            isPositive ? "text-success" : isUnanswered ? "text-muted-foreground" : "text-destructive"
          )}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold">
            <span className="grid size-6 place-items-center rounded-full border border-current/25 bg-background/60">
              {isPositive ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : isUnanswered ? (
                <Minus className="size-3.5" aria-hidden="true" />
              ) : (
                <X className="size-3.5" aria-hidden="true" />
              )}
            </span>
            {isMemorizeMode ? "背题解析" : isUnanswered ? "本题未作答" : isCorrect ? "本题正确" : "本题错误"}
            <span className="text-muted-foreground">·</span>
            <span className="text-foreground">正确答案 <strong className="student-heading ml-1 text-lg">{correctAnswer || "暂无"}</strong></span>
            {!isMemorizeMode ? <span className="text-foreground">我的答案 <strong className="student-heading ml-1 text-lg">{answer || "未作答"}</strong></span> : null}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3">
            <h3 className="student-heading text-lg font-semibold">解析校准</h3>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="mt-4 text-sm leading-7 text-foreground/90">
            {analysisHtml ? <RichHtml html={analysisHtml} className="leading-7" /> : <p className="text-muted-foreground">暂无解析。</p>}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
