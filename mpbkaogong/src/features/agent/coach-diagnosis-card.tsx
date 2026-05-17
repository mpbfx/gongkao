"use client";

import { ArrowRight, Bot, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Recommendation = {
  id: string;
  title: string;
  evidence: string[];
  action: {
    type: string;
    tagName?: string;
    count?: number;
  };
  confidence: "LOW" | "MEDIUM" | "HIGH";
  status: string;
  startedSessionId: string | null;
};

type Diagnosis = {
  summary: {
    title: string;
    totalSessions: number;
    totalAnswers: number;
  };
  evidence: string[];
  recommendations: Recommendation[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
};

type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { message: string } };

function recommendationLabel(recommendation: Recommendation) {
  if (recommendation.action.type === "SPECIAL_PRACTICE") {
    return `专项 ${recommendation.action.count ?? 10} 题`;
  }

  if (recommendation.action.type === "WRONG_MEMORIZE") {
    return `背题 ${recommendation.action.count ?? 10} 题`;
  }

  if (recommendation.action.type === "WRONG_PRACTICE") {
    return `错题 ${recommendation.action.count ?? 10} 题`;
  }

  return "每日一练";
}

export function CoachDiagnosisCard({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);

  const loadDiagnosis = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/agent/coach/sessions/${sessionId}`);
      const payload = (await response.json()) as ApiResponse<Diagnosis>;

      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }

      setDiagnosis(payload.data);
    } catch {
      setError("学习教练暂时不可用");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  async function startRecommendation(recommendationId: string) {
    setStartingId(recommendationId);

    try {
      const response = await fetch(`/api/agent/coach/recommendations/${recommendationId}/start`, {
        method: "POST",
      });
      const payload = (await response.json()) as ApiResponse<{ session: { id: string } }>;

      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }

      router.push(`/practice/${payload.data.session.id}`);
    } catch {
      setError("推荐训练创建失败，请稍后重试");
    } finally {
      setStartingId(null);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadDiagnosis();
    });
  }, [loadDiagnosis]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LoaderCircle className="animate-spin" aria-hidden="true" />
            正在生成下一步训练建议
          </CardTitle>
          <CardDescription>正在读取本次练习和近期错题表现，完成后会给出可直接开始的训练。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="h-24 rounded-lg bg-muted" />
          <div className="h-24 rounded-lg bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <Bot aria-hidden="true" />
        <AlertTitle>学习教练未能加载</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={loadDiagnosis}>
            <RotateCcw data-icon="inline-start" />
            重试
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!diagnosis) {
    return null;
  }
  const visibleRecommendations = diagnosis.recommendations.slice(0, 2);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles aria-hidden="true" />
          下一步训练建议
        </CardTitle>
        <CardDescription>{diagnosis.summary.title}</CardDescription>
      </CardHeader>
      <CardContent>
        {visibleRecommendations.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {visibleRecommendations.map((recommendation) => (
              <div key={recommendation.id} className="flex flex-col gap-3 rounded-lg border p-3">
                <div className="flex flex-col gap-1">
                  <div className="font-medium">{recommendation.title}</div>
                  <div className="text-sm text-muted-foreground">{recommendationLabel(recommendation)}</div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="mt-auto w-full"
                  disabled={startingId === recommendation.id}
                  onClick={() => startRecommendation(recommendation.id)}
                >
                  {startingId === recommendation.id ? (
                    <LoaderCircle data-icon="inline-start" className="animate-spin" />
                  ) : (
                    <ArrowRight data-icon="inline-start" />
                  )}
                  开始训练
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">本次暂无新的训练建议，可继续每日一练或回看错题。</p>
        )}
      </CardContent>
    </Card>
  );
}
