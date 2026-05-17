import { AlertTriangle, ArrowLeft, BarChart3, Brain, CheckCircle2, Clock3, Filter, Target } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MetricStrip,
  PageHeader,
  StudentPage,
  TrainingPanel,
} from "@/components/student/page-building-blocks";
import {
  KnowledgePatternMatrix,
  MistakeDistributionChart,
  MistakeTrendChart,
} from "@/features/agent/mistake-insights-charts";
import { requireUser } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { getMistakeInsights, insightRanges, type InsightRange } from "@/server/agent/mistakes/service";

type MistakeInsightsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseRange(value: string | undefined): InsightRange {
  return insightRanges.includes(value as InsightRange) ? (value as InsightRange) : "30";
}

function parseIncludeResolved(value: string | undefined) {
  return value === "true";
}

function buildInsightsHref({
  range,
  includeResolved,
}: {
  range: InsightRange;
  includeResolved: boolean;
}) {
  const params = new URLSearchParams();

  if (range !== "30") {
    params.set("range", range);
  }

  if (includeResolved) {
    params.set("includeResolved", "true");
  }

  const query = params.toString();
  return `/question-bank/wrong/insights${query ? `?${query}` : ""}`;
}

export default async function MistakeInsightsPage({ searchParams }: MistakeInsightsPageProps) {
  const user = await requireUser().catch(() => null);

  if (!user) {
    redirect("/login?callbackUrl=/question-bank/wrong/insights");
  }

  const rawParams = await searchParams;
  const range = parseRange(firstValue(rawParams?.range));
  const includeResolved = parseIncludeResolved(firstValue(rawParams?.includeResolved));
  const insights = await getMistakeInsights(user, { range, includeResolved });
  const dominant = insights.summary.dominantCause;

  return (
    <AppShell>
      <StudentPage wide>
        <PageHeader
          eyebrow="错因报告"
          title="看见错题背后的真实模式"
          description="按每道题最新一次结构化复盘统计，默认聚焦未掌握错题；趋势用于决定下一批该复盘什么。"
          actions={
            <>
              <Link href="/question-bank/wrong" className={cn(buttonVariants({ variant: "outline" }))}>
                <ArrowLeft data-icon="inline-start" />
                返回错题本
              </Link>
              <Link
                href={buildInsightsHref({ range, includeResolved: !includeResolved })}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <Filter data-icon="inline-start" />
                {includeResolved ? "只看未掌握" : "包含已掌握"}
              </Link>
            </>
          }
        />

        <div className="flex flex-wrap gap-2">
          {insightRanges.map((item) => (
            <Link
              key={item}
              href={buildInsightsHref({ range: item, includeResolved })}
              className={cn(buttonVariants({ variant: item === range ? "default" : "outline", size: "sm" }))}
            >
              {item === "all" ? "全部" : `近 ${item} 天`}
            </Link>
          ))}
        </div>

        <MetricStrip
          items={[
            {
              label: "已分析",
              value: insights.summary.analyzedCount,
              description: includeResolved ? "包含已掌握" : "未掌握错题",
              icon: CheckCircle2,
              tone: "success",
            },
            {
              label: "未分析",
              value: insights.summary.unanalyzedCount,
              description: "建议继续问助教",
              icon: AlertTriangle,
              tone: insights.summary.unanalyzedCount > 0 ? "warning" : "success",
            },
            {
              label: "当前主因",
              value: dominant?.label ?? "暂无",
              description: dominant ? `${dominant.count} 道题` : "先完成复盘",
              icon: Target,
              tone: dominant ? "info" : "default",
            },
            {
              label: "报告范围",
              value: range === "all" ? "全部" : `${range}天`,
              description: "日趋势 + 7日均线",
              icon: Clock3,
              tone: "info",
            },
          ]}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)]">
          <TrainingPanel
            title="错因趋势"
            description="折线展示每日结构化复盘数量，均线帮助过滤单日波动。"
            icon={BarChart3}
          >
            <MistakeTrendChart data={insights.trend} />
          </TrainingPanel>

          <TrainingPanel
            title="错因分布"
            description="默认按当前范围内、每题最新错因统计。"
            icon={Brain}
            tone={dominant ? "info" : "default"}
          >
            {insights.distribution.length > 0 ? (
              <MistakeDistributionChart data={insights.distribution} />
            ) : (
              <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                暂无可统计错因。回到错题本，点开错题的“问助教”即可自动生成结构化复盘。
              </div>
            )}
          </TrainingPanel>
        </div>

        <TrainingPanel
          title="知识点 × 错因矩阵"
          description="比单纯“哪个知识点弱”更进一步，定位弱点背后的具体原因。"
          icon={Target}
        >
          <KnowledgePatternMatrix data={insights.knowledgePatterns} />
        </TrainingPanel>

        <Card>
          <CardHeader>
            <CardTitle>下一步动作</CardTitle>
            <CardDescription>报告里的每个数字都要能回到具体错题。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/question-bank/wrong?analysis=unanalyzed" className={cn(buttonVariants())}>
              分析未分类错题
            </Link>
            {dominant ? (
              <Link
                href={`/question-bank/wrong?analysis=analyzed&mistakeCause=${dominant.cause}`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                查看 {dominant.label} 错题
              </Link>
            ) : null}
            {insights.knowledgePatterns.slice(0, 3).map((item) => (
              <Link
                key={`${item.tagId ?? "untagged"}-${item.cause}`}
                href={`/question-bank/wrong?analysis=analyzed${item.tagId ? `&tagId=${item.tagId}` : ""}&mistakeCause=${item.cause}`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                {item.tagName} / {item.label}
              </Link>
            ))}
          </CardContent>
        </Card>
        <Badge variant="outline" className="w-fit">
          {includeResolved ? "当前包含已掌握错题" : "当前只看未掌握错题"}
        </Badge>
      </StudentPage>
    </AppShell>
  );
}
