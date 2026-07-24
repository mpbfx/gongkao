import {
  ArrowRight,
  BarChart3,
  BookMarked,
  ChartNoAxesCombined,
  Grid3X3,
  Target,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { buttonVariants } from "@/components/ui/button";
import {
  MetricStrip,
  PageHeader,
  StudentPage,
} from "@/components/student/page-building-blocks";
import {
  AccuracyTrendChart,
  AnswerCompositionChart,
  KnowledgeHeatmapChart,
  PracticeModeChart,
  WeakKnowledgeChart,
  WrongResolutionChart,
} from "@/features/learning/learning-situation-charts";
import { requireUser } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { getBaselineTrainingState } from "@/server/services/baseline-training";
import { getLearningSituation } from "@/server/services/learning-situation";
import { getFoundationProgress } from "@/server/services/foundation-training";
import { getNextTrainingAction } from "@/server/services/training-plan";

function formatDuration(seconds: number) {
  if (seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分`;
  return `${Math.floor(minutes / 60)}时${minutes % 60}分`;
}

function DashboardPanel({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  icon: typeof BarChart3;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("learning-dashboard-panel flex min-h-0 min-w-0 flex-col overflow-hidden border border-foreground/35 bg-card/50", className)}>
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-foreground/20 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center border border-foreground/20 bg-muted/70">
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="student-heading truncate text-sm font-semibold md:text-base">{title}</h2>
            {description ? <p className="truncate text-xs text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn("min-h-0 flex-1 p-3 md:p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

function CompactEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-full min-h-28 place-items-center border border-dashed border-foreground/25 px-4 text-center text-sm leading-6 text-muted-foreground">
      {children}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser().catch(() => null);

  if (!user) redirect("/login?callbackUrl=/dashboard");

  const [situation, baseline, foundation, nextAction] = await Promise.all([
    getLearningSituation(user),
    getBaselineTrainingState(user),
    getFoundationProgress(user),
    getNextTrainingAction(user),
  ]);
  const hasTrend = situation.accuracyTrend.length >= 2;
  const hasHeatmap = situation.knowledgeHeatmap.tags.length > 0;
  const hasModes = situation.modeComparison.length > 0;
  const hasWrongQuestions = situation.wrongSummary.totalCount > 0;
  const hasWeakKnowledge = situation.weakKnowledge.length > 0;
  const panelActionClass = cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2.5 text-xs");

  return (
    <AppShell header={{ title: "学习情况", subtitle: "用真实练习记录持续校准" }}>
      <StudentPage layout="wide" className="learning-situation-page learning-dashboard gap-5">
        <PageHeader
          eyebrow="学情校准"
          title="学习情况"
          description="用已提交练习判断下一步训练方向，而不是堆叠更多图表。"
          primaryAction={
            <Link href={nextAction.href} className={cn(buttonVariants(), "h-10")}>
              {nextAction.label}
              <ArrowRight data-icon="inline-end" />
            </Link>
          }
        />

        <section className="border-y-2 border-foreground bg-card/50">
          <div className="grid lg:grid-cols-[minmax(0,1.4fr)_auto]">
            <div className="border-b border-foreground/20 p-5 lg:border-b-0 lg:border-r lg:p-6">
              <div className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">下一步训练</div>
              <h2 className="student-heading mt-2 text-xl font-semibold md:text-2xl">{nextAction.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                已完成 {situation.summary.totalSessions} 次练习、{situation.summary.totalQuestions} 题，
                整体正确率 {situation.summary.overallAccuracy ?? "—"}%，累计用时 {formatDuration(situation.summary.totalElapsedSeconds)}。
              </p>
            </div>
            <div className="grid grid-cols-2 lg:w-[22rem]">
              <div className="border-r border-foreground/15 p-4 lg:p-5">
                <div className="text-xs text-muted-foreground">基准成绩</div>
                <div className="student-heading mt-1 text-lg font-semibold">
                  {baseline.submitted ? `${baseline.submitted.score ?? "0"}/${baseline.submitted.maxScore ?? "0"}` : "可选"}
                </div>
              </div>
              <div className="p-4 lg:p-5">
                <div className="text-xs text-muted-foreground">筑基进度</div>
                <div className="student-heading mt-1 text-lg font-semibold">
                  {foundation.passedCount}/{foundation.totalCount}
                </div>
              </div>
              <div className="col-span-2 border-t border-foreground/15 p-4 lg:p-5">
                <div className="text-xs text-muted-foreground">待复盘错题</div>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <div className="student-heading text-2xl font-semibold tabular-nums">
                    {situation.wrongSummary.unresolvedCount}
                  </div>
                  <Link href="/question-bank/wrong" className="text-xs font-medium text-primary hover:underline">
                    去复盘
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <MetricStrip
          compact
          items={[
            { label: "练习次数", value: situation.summary.totalSessions },
            { label: "作答题量", value: situation.summary.totalQuestions },
            { label: "正确率", value: `${situation.summary.overallAccuracy ?? "—"}%` },
            { label: "累计用时", value: formatDuration(situation.summary.totalElapsedSeconds) },
          ]}
        />

        <div className="learning-dashboard-grid grid gap-4 lg:grid-cols-12">
          <DashboardPanel
            title="近期正确率"
            description="至少两次提交后显示趋势"
            icon={BarChart3}
            className="lg:col-span-8 lg:min-h-[22rem]"
            bodyClassName="h-[16rem] lg:h-[18rem]"
          >
            {hasTrend ? <AccuracyTrendChart data={situation.accuracyTrend} /> : <CompactEmpty>至少提交两次练习后才绘制趋势线。</CompactEmpty>}
          </DashboardPanel>

          <DashboardPanel
            title="薄弱知识点"
            description="按待复盘压力排序"
            icon={Target}
            className="lg:col-span-4 lg:min-h-[22rem]"
            bodyClassName="h-[16rem] lg:h-[18rem]"
            action={
              <Link href="/question-bank/wrong" className={panelActionClass}>
                错题本
                <ArrowRight data-icon="inline-end" />
              </Link>
            }
          >
            {hasWeakKnowledge ? <WeakKnowledgeChart data={situation.weakKnowledge} /> : <CompactEmpty>当前没有待复盘知识点。</CompactEmpty>}
          </DashboardPanel>
        </div>

        <details className="group border border-foreground/35 bg-card/30">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <span>更多分析</span>
            <span className="text-xs font-normal text-muted-foreground">训练类型、作答构成、错题消化、热力图</span>
          </summary>
          <div className="grid gap-4 border-t border-foreground/20 p-4 lg:grid-cols-12">
            <DashboardPanel title="训练类型对比" icon={ChartNoAxesCombined} className="lg:col-span-6 lg:min-h-[17rem]" bodyClassName="h-[14rem]">
              {hasModes ? <PracticeModeChart data={situation.modeComparison} /> : <CompactEmpty>暂无可比较的训练类型。</CompactEmpty>}
            </DashboardPanel>
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-6">
              <DashboardPanel title="作答构成" icon={Target} className="min-h-[17rem]" bodyClassName="h-[12rem]">
                {situation.summary.totalQuestions > 0 ? (
                  <AnswerCompositionChart
                    correctCount={situation.summary.correctCount}
                    wrongCount={situation.summary.wrongCount}
                    unansweredCount={situation.summary.unansweredCount}
                  />
                ) : (
                  <CompactEmpty>暂无作答数据。</CompactEmpty>
                )}
              </DashboardPanel>
              <DashboardPanel title="错题消化" icon={BookMarked} className="min-h-[17rem]" bodyClassName="h-[12rem]">
                {hasWrongQuestions ? (
                  <WrongResolutionChart
                    resolvedCount={situation.wrongSummary.resolvedCount}
                    unresolvedCount={situation.wrongSummary.unresolvedCount}
                  />
                ) : (
                  <CompactEmpty>暂无错题状态。</CompactEmpty>
                )}
              </DashboardPanel>
            </div>
            <DashboardPanel
              title="知识点热力图"
              description="近八周作答分布"
              icon={Grid3X3}
              className="lg:col-span-12 lg:min-h-[18rem]"
              bodyClassName="h-[15rem]"
              action={
                <Link href="/question-bank/special" className={panelActionClass}>
                  专项组卷
                  <ArrowRight data-icon="inline-end" />
                </Link>
              }
            >
              {hasHeatmap ? <KnowledgeHeatmapChart {...situation.knowledgeHeatmap} /> : <CompactEmpty>近八周暂无知识点作答数据。</CompactEmpty>}
            </DashboardPanel>
          </div>
        </details>

        <section className="sr-only" aria-label="学习情况图表数据摘要">
          <h2>最近练习正确率数据</h2>
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>类型</th>
                <th>正确率</th>
                <th>已答题数</th>
              </tr>
            </thead>
            <tbody>
              {situation.accuracyTrend.map((item) => (
                <tr key={item.id}>
                  <td>{item.dateLabel}</td>
                  <td>{item.modeLabel}</td>
                  <td>{item.accuracy}%</td>
                  <td>
                    {item.answeredCount}/{item.totalCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </StudentPage>
    </AppShell>
  );
}
