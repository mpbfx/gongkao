"use client";

import { Check, LoaderCircle, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { message: string } };

type Comparison = {
  baseline: { title: string; reflectionText: string | null; pauseCount: number; pausedSeconds: number; events: Record<string, number> };
  current: { title: string; reflectionText: string | null; pauseCount: number; pausedSeconds: number; events: Record<string, number> };
  delta: { score: number; elapsedSeconds: number; accuracy: number };
  sections: Array<{
    name: string;
    baseline: { accuracy: number; elapsedSeconds: number } | null;
    current: { accuracy: number; elapsedSeconds: number } | null;
  }>;
  improvements: string[];
} | null;

export function PracticeReflectionPanel({
  sessionId,
  initialText,
}: {
  sessionId: string;
  initialText?: string | null;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [comparison, setComparison] = useState<Comparison>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/practice/sessions/${sessionId}/comparison`, { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: ApiResponse<Comparison>) => {
        if (payload.ok) setComparison(payload.data);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [sessionId]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const response = await fetch(`/api/practice/sessions/${sessionId}/reflection`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reflectionText: text }),
      });
      const payload = (await response.json()) as ApiResponse<unknown>;
      if (payload.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-t border-foreground/20 bg-card/55 p-4">
      {comparison ? (
        <div className="mb-5">
          <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground">相对 BENCHMARK</div>
          <dl className="mt-3 grid grid-cols-3 border-y border-foreground/20 text-center text-xs">
            <div className="py-2"><dt className="text-muted-foreground">分数变化</dt><dd className="mt-1 font-mono font-semibold">{comparison.delta.score >= 0 ? "+" : ""}{comparison.delta.score}</dd></div>
            <div className="border-x border-foreground/20 py-2"><dt className="text-muted-foreground">正确率</dt><dd className="mt-1 font-mono font-semibold">{comparison.delta.accuracy >= 0 ? "+" : ""}{comparison.delta.accuracy}%</dd></div>
            <div className="py-2"><dt className="text-muted-foreground">用时变化</dt><dd className="mt-1 font-mono font-semibold">{comparison.delta.elapsedSeconds >= 0 ? "+" : ""}{comparison.delta.elapsedSeconds}s</dd></div>
          </dl>
          {comparison.improvements.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-success">
              {comparison.improvements.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}
            </ul>
          ) : null}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-96 border-collapse text-xs">
              <thead><tr className="border-y border-foreground/20 text-muted-foreground"><th className="py-2 text-left">模块</th><th>基准正确率</th><th>本次正确率</th><th>用时变化</th></tr></thead>
              <tbody>{comparison.sections.map((section) => (
                <tr key={section.name} className="border-b border-foreground/12">
                  <th className="py-2 text-left font-medium">{section.name}</th>
                  <td className="text-center">{section.baseline?.accuracy ?? 0}%</td>
                  <td className="text-center">{section.current?.accuracy ?? 0}%</td>
                  <td className="text-center">{(section.current?.elapsedSeconds ?? 0) - (section.baseline?.elapsedSeconds ?? 0)}s</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            跳题 {comparison.baseline.events.SKIP ?? 0} → {comparison.current.events.SKIP ?? 0}；
            返回 {comparison.baseline.events.RETURN ?? 0} → {comparison.current.events.RETURN ?? 0}；
            改答案 {comparison.baseline.events.ANSWER_CHANGE ?? 0} → {comparison.current.events.ANSWER_CHANGE ?? 0}；
            暂停 {comparison.baseline.pauseCount} → {comparison.current.pauseCount}
          </p>
        </div>
      ) : null}
      <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground">考后自由总结</div>
      <p className="mt-2 text-sm text-muted-foreground">这次做卷时，操作上和心理上有什么感受？</p>
      <Textarea className="mt-3 min-h-24" maxLength={5000} value={text} onChange={(event) => { setText(event.target.value); setSaved(false); }} />
      <Button className="mt-3" size="sm" disabled={saving} onClick={save}>
        {saving ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : saved ? <Check data-icon="inline-start" /> : <Save data-icon="inline-start" />}
        {saved ? "已保存" : "保存总结"}
      </Button>
    </section>
  );
}
