import type { CoachConfig, AgentRecommendationAction } from "@/server/agent/shared/schemas";

export type TagMetric = {
  tagId: string | null;
  tagName: string;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  totalTimeSeconds: number;
  unresolvedWrongCount: number;
};

export type DraftRecommendation = {
  type: string;
  title: string;
  evidence: string[];
  action: AgentRecommendationAction;
  confidence: "LOW" | "MEDIUM" | "HIGH";
};

function accuracy(metric: TagMetric) {
  return metric.answeredCount > 0 ? metric.correctCount / metric.answeredCount : 0;
}

function averageTime(metric: TagMetric) {
  return metric.answeredCount > 0 ? metric.totalTimeSeconds / metric.answeredCount : 0;
}

function confidenceFor(metric: TagMetric, config: CoachConfig) {
  if (metric.answeredCount >= config.minAnswersPerTag * 3 || metric.unresolvedWrongCount >= 8) {
    return "HIGH" as const;
  }

  if (metric.answeredCount >= config.minAnswersPerTag) {
    return "MEDIUM" as const;
  }

  return "LOW" as const;
}

export function rankTagMetrics(metrics: TagMetric[], config: CoachConfig, overallAverageTimeSeconds: number) {
  return metrics
    .filter((metric) => metric.answeredCount >= config.minAnswersPerTag)
    .map((metric) => {
      const metricAccuracy = accuracy(metric);
      const metricAverageTime = averageTime(metric);
      const slowPenalty =
        overallAverageTimeSeconds > 0 && metricAverageTime > overallAverageTimeSeconds * config.slowTimeMultiplier
          ? 18
          : 0;

      return {
        metric,
        score: (1 - metricAccuracy) * 100 + metric.unresolvedWrongCount * 8 + slowPenalty,
        metricAccuracy,
        metricAverageTime,
        isSlow:
          overallAverageTimeSeconds > 0 && metricAverageTime > overallAverageTimeSeconds * config.slowTimeMultiplier,
      };
    })
    .toSorted((first, second) => second.score - first.score);
}

export function buildDraftRecommendations({
  metrics,
  config,
  overallAverageTimeSeconds,
}: {
  metrics: TagMetric[];
  config: CoachConfig;
  overallAverageTimeSeconds: number;
}) {
  const ranked = rankTagMetrics(metrics, config, overallAverageTimeSeconds);
  const recommendations: DraftRecommendation[] = [];

  for (const item of ranked) {
    if (recommendations.length >= config.maxRecommendations) {
      break;
    }

    const { metric, metricAccuracy, metricAverageTime, isSlow } = item;
    const accuracyPercent = Math.round(metricAccuracy * 100);
    const evidence = [
      `${metric.tagName} 近况正确率 ${accuracyPercent}%`,
      `${metric.tagName} 已答 ${metric.answeredCount} 题，错 ${metric.wrongCount} 题`,
    ];

    if (metric.unresolvedWrongCount > 0) {
      evidence.push(`未掌握错题 ${metric.unresolvedWrongCount} 道`);
    }

    if (isSlow) {
      evidence.push(`平均每题 ${Math.round(metricAverageTime)} 秒，明显高于个人均值`);
    }

    if (metric.unresolvedWrongCount >= 3) {
      recommendations.push({
        type: "WRONG_PRACTICE",
        title: `重练 ${metric.tagName} 错题`,
        evidence,
        action: {
          type: "WRONG_PRACTICE",
          tagId: metric.tagId,
          tagName: metric.tagName,
          count: Math.min(10, metric.unresolvedWrongCount),
        },
        confidence: confidenceFor(metric, config),
      });
      continue;
    }

    if (metric.tagId) {
      recommendations.push({
        type: "SPECIAL_PRACTICE",
        title: `专项练 ${metric.tagName}`,
        evidence,
        action: {
          type: "SPECIAL_PRACTICE",
          tagId: metric.tagId,
          tagName: metric.tagName,
          difficulty: null,
          count: 10,
        },
        confidence: confidenceFor(metric, config),
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: "DAILY_PRACTICE",
      title: "先完成一次每日一练",
      evidence: ["当前诊断窗口内有效答题数据不足", "完成每日一练后，学习教练能给出更准的薄弱点判断"],
      action: {
        type: "DAILY_PRACTICE",
      },
      confidence: "LOW",
    });
  }

  return recommendations.slice(0, config.maxRecommendations);
}

