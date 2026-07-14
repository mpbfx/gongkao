"use client";

import { LoaderCircle, Save, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaperStartButton } from "@/features/papers/paper-start-button";

type PaperOption = {
  id: string;
  title: string;
  year: number | null;
  province: string | null;
  examType: string | null;
  durationSeconds: number | null;
};

type Goal = {
  targetPaper: PaperOption;
  recommendedBaseline: PaperOption | null;
  inProgressBaseline: { id: string; title: string } | null;
  baselineSession: { id: string; title: string; score: string | null; maxScore: string | null } | null;
} | null;

type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { message: string } };

export function ExamGoalWorkspace({ papers, goal }: { papers: PaperOption[]; goal: Goal }) {
  const router = useRouter();
  const [targetPaperId, setTargetPaperId] = useState(goal?.targetPaper.id ?? papers[0]?.id ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveGoal() {
    if (!targetPaperId) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/exam-goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPaperId }),
      });
      const payload = (await response.json()) as ApiResponse<Goal>;
      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }
      router.refresh();
    } catch {
      setError("保存目标考试失败，请稍后重试。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="border-y-2 border-foreground bg-card/40 p-5">
        <div className="flex items-center gap-2 text-primary"><Target className="size-5" /><span className="text-xs font-semibold tracking-[0.2em]">TARGET EXAM</span></div>
        <h2 className="student-heading mt-3 text-2xl font-semibold">选择当前准备的考试</h2>
        <p className="mt-2 text-sm text-muted-foreground">目标来自已收录试卷，系统将自动寻找同地区、同考试类型的前一年真题。</p>
        <label className="mt-6 block">
          <span className="mb-2 block text-sm font-medium">目标考试</span>
          <select
            value={targetPaperId}
            onChange={(event) => setTargetPaperId(event.target.value)}
            className="min-h-12 w-full border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {papers.map((paper) => <option key={paper.id} value={paper.id}>{paper.title}</option>)}
          </select>
        </label>
        <Button className="mt-5" disabled={isSaving || !targetPaperId || targetPaperId === goal?.targetPaper.id} onClick={saveGoal}>
          {isSaving ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Save data-icon="inline-start" />}
          保存目标
        </Button>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </section>

      <aside className="border-y-2 border-foreground bg-card/55 p-5">
        <span className="text-xs text-muted-foreground">当前训练起点</span>
        {goal ? (
          <>
            <h3 className="student-heading mt-2 text-xl font-semibold">{goal.targetPaper.title}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {goal.targetPaper.year ? <Badge>{goal.targetPaper.year}</Badge> : null}
              {goal.targetPaper.province ? <Badge variant="outline">{goal.targetPaper.province}</Badge> : null}
              {goal.targetPaper.examType ? <Badge variant="outline">{goal.targetPaper.examType}</Badge> : null}
            </div>

            {goal.baselineSession ? (
              <Alert variant="success" className="mt-6">
                <AlertTitle>benchmark 已建立</AlertTitle>
                <AlertDescription>{goal.baselineSession.title} · {goal.baselineSession.score ?? "0"}/{goal.baselineSession.maxScore ?? "0"} 分</AlertDescription>
              </Alert>
            ) : goal.inProgressBaseline ? (
              <Button className="mt-6 w-full" onClick={() => router.push(`/practice/${goal.inProgressBaseline?.id}`)}>继续 benchmark</Button>
            ) : goal.recommendedBaseline ? (
              <div className="mt-6 border-t pt-5">
                <div className="text-xs text-muted-foreground">推荐前一年真题</div>
                <strong className="mt-1 block text-sm">{goal.recommendedBaseline.title}</strong>
                <PaperStartButton
                  paperId={goal.recommendedBaseline.id}
                  purpose="BASELINE"
                  durationSeconds={goal.recommendedBaseline.durationSeconds}
                  className="mt-4 w-full"
                />
              </div>
            ) : (
              <div>
                <Alert variant="warning" className="mt-6">
                  <AlertTitle>未匹配到前一年试卷</AlertTitle>
                  <AlertDescription>可前往历年试卷页选择一套真题作为 benchmark。</AlertDescription>
                </Alert>
                <Button className="mt-3 w-full" variant="outline" onClick={() => router.push("/question-bank/papers?purpose=BASELINE")}>手动选择试卷</Button>
              </div>
            )}
          </>
        ) : <p className="mt-3 text-sm text-muted-foreground">保存目标后显示 benchmark 建议。</p>}
      </aside>
    </div>
  );
}
