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
import { StudentPage } from "@/components/student/page-building-blocks";
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
  question,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
  compact = false,
}: {
  title: string;
  question?: string;
  icon: typeof BarChart3;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  compact?: boolean;
}) {
  return (
    <section className={cn("learning-dashboard-panel min-w-0 overflow-hidden border-y border-foreground/55 bg-card/35", className)}>
      <header className={cn("flex items-center justify-between gap-2 border-b border-foreground/25 px-3", compact ? "min-h-9 py-1.5" : "min-h-11 py-2")}>
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("grid shrink-0 place-items-center border border-foreground/20 bg-muted/70", compact ? "size-6" : "size-7")}>
            <Icon className={compact ? "size-3" : "size-3.5"} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className={cn("student-heading truncate font-semibold", compact ? "text-xs" : "text-sm")}>{title}</h2>
            {question ? <p className="truncate text-[0.65rem] leading-4 text-muted-foreground">{question}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn("min-h-0 p-2", bodyClassName)}>{children}</div>
    </section>
  );
}

function CompactEmpty({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full min-h-24 place-items-center border border-dashed border-foreground/25 px-4 text-center text-xs leading-5 text-muted-foreground">{children}</div>;
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

  const panelActionClass = cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 text-[0.68rem]");

  return (
    <AppShell header={{ title: "学习情况", subtitle: "用真实练习记录持续校准" }}>
      <StudentPage layout="wide" className="learning-situation-page learning-dashboard gap-4 py-4 pb-24 lg:px-7 lg:py-5">
        <header className="learning-dashboard-header border-b-2 border-foreground pb-4">
          <div className="min-w-0">
            <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h1 className="student-heading text-2xl font-semibold tracking-tight md:text-3xl">学习情况</h1>
              <p className="text-sm text-muted-foreground">用已提交练习判断下一步训练方向</p>
            </div>
          </div>
        </header>

        <section className="grid border-y-2 border-foreground bg-card/45 lg:grid-cols-[minmax(0,1fr)_14rem_14rem_auto]">
          <div className="border-b border-foreground/20 p-3.5 lg:border-b-0 lg:border-r">
            <div className="text-[0.65rem] tracking-[0.18em] text-muted-foreground">下一步训练</div>
            <div className="student-heading mt-1 text-lg font-semibold">{nextAction.title}</div>
          </div>
          <div className="border-b border-foreground/20 p-3.5 lg:border-b-0 lg:border-r">
            <div className="text-[0.65rem] tracking-[0.18em] text-muted-foreground">基准成绩</div>
            <div className="student-heading mt-1 text-lg font-semibold">{baseline.submitted ? `${baseline.submitted.score ?? "0"}/${baseline.submitted.maxScore ?? "0"} 分` : "可选"}</div>
          </div>
          <div className="border-b border-foreground/20 p-3.5 lg:border-b-0 lg:border-r">
            <div className="text-[0.65rem] tracking-[0.18em] text-muted-foreground">筑基进度</div>
            <div className="student-heading mt-1 text-lg font-semibold">{foundation.passedCount}/{foundation.totalCount} 个叶子类型</div>
          </div>
          <div className="flex items-center p-3.5">
            <Link href={nextAction.href} className={cn(buttonVariants(), "w-full")}>{nextAction.label}<ArrowRight data-icon="inline-end" /></Link>
          </div>
        </section>

        <p className="border-b border-foreground/25 pb-3 text-sm text-muted-foreground">
          已完成 <strong className="text-foreground">{situation.summary.totalSessions}</strong> 次练习、{situation.summary.totalQuestions} 题，
          整体正确率 <strong className="text-foreground">{situation.summary.overallAccuracy ?? "—"}%</strong>，
          累计用时 {formatDuration(situation.summary.totalElapsedSeconds)}，还有 {situation.wrongSummary.unresolvedCount} 道错题待复盘。
        </p>

        <div className="learning-dashboard-grid grid gap-4 lg:grid-cols-12">
          <DashboardPanel
            title="近期正确率"
            icon={BarChart3}
            className="lg:col-span-8 lg:h-[23rem]"
            bodyClassName="h-[calc(100%-2.75rem)]"
          >
            {hasTrend ? <AccuracyTrendChart data={situation.accuracyTrend} /> : <CompactEmpty>至少提交两次练习后才绘制趋势线。</CompactEmpty>}
          </DashboardPanel>

          <DashboardPanel
            title="薄弱知识点排行"
            icon={Target}
            className="lg:col-span-4 lg:h-[23rem]"
            bodyClassName="h-[calc(100%-2.75rem)]"
            action={<Link href="/question-bank/wrong" className={panelActionClass}>进入错题<ArrowRight data-icon="inline-end" /></Link>}
          >
            {hasWeakKnowledge ? <WeakKnowledgeChart data={situation.weakKnowledge} /> : <CompactEmpty>当前没有待复盘知识点。</CompactEmpty>}
          </DashboardPanel>
        </div>

        <details className="group border-y border-foreground/45 bg-card/25">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            更多分析
            <span className="text-xs text-muted-foreground group-open:hidden">训练类型、作答构成、错题消化与知识点热力图</span>
          </summary>
          <div className="grid gap-4 border-t p-4 lg:grid-cols-12">
            <DashboardPanel title="训练类型对比" icon={ChartNoAxesCombined} className="lg:col-span-6 lg:h-[18rem]" bodyClassName="h-[calc(100%-2.75rem)]">
              {hasModes ? <PracticeModeChart data={situation.modeComparison} /> : <CompactEmpty>暂无可比较的训练类型。</CompactEmpty>}
            </DashboardPanel>
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-6 lg:h-[18rem]">
              <DashboardPanel title="作答构成" icon={Target} compact className="h-full" bodyClassName="pt-0">
                {situation.summary.totalQuestions > 0 ? <AnswerCompositionChart correctCount={situation.summary.correctCount} wrongCount={situation.summary.wrongCount} unansweredCount={situation.summary.unansweredCount} /> : <CompactEmpty>暂无作答数据。</CompactEmpty>}
              </DashboardPanel>
              <DashboardPanel title="错题消化" icon={BookMarked} compact className="h-full" bodyClassName="pt-0">
                {hasWrongQuestions ? <WrongResolutionChart resolvedCount={situation.wrongSummary.resolvedCount} unresolvedCount={situation.wrongSummary.unresolvedCount} /> : <CompactEmpty>暂无错题状态。</CompactEmpty>}
              </DashboardPanel>
            </div>
            <DashboardPanel title="知识点热力图" icon={Grid3X3} className="lg:col-span-12 lg:h-[19rem]" bodyClassName="h-[calc(100%-2.75rem)]" action={<Link href="/question-bank/special" className={panelActionClass}>专项组卷<ArrowRight data-icon="inline-end" /></Link>}>
              {hasHeatmap ? <KnowledgeHeatmapChart {...situation.knowledgeHeatmap} /> : <CompactEmpty>近八周暂无知识点作答数据。</CompactEmpty>}
            </DashboardPanel>
          </div>
        </details>

        <section className="sr-only" aria-label="学习情况图表数据摘要">
          <h2>最近练习正确率数据</h2>
          <table><thead><tr><th>日期</th><th>类型</th><th>正确率</th><th>已答题数</th></tr></thead><tbody>
            {situation.accuracyTrend.map((item) => <tr key={item.id}><td>{item.dateLabel}</td><td>{item.modeLabel}</td><td>{item.accuracy}%</td><td>{item.answeredCount}/{item.totalCount}</td></tr>)}
          </tbody></table>
          <h2>训练类型对比数据</h2>
          <table><thead><tr><th>类型</th><th>次数</th><th>题量</th><th>正确率</th></tr></thead><tbody>
            {situation.modeComparison.map((item) => <tr key={item.mode}><td>{item.label}</td><td>{item.sessionCount}</td><td>{item.totalQuestions}</td><td>{item.accuracy === null ? "无数据" : `${item.accuracy}%`}</td></tr>)}
          </tbody></table>
          <h2>薄弱知识点数据</h2>
          <table><thead><tr><th>知识点</th><th>待复盘</th><th>重复错误</th><th>历史正确率</th></tr></thead><tbody>
            {situation.weakKnowledge.map((item) => <tr key={item.tagId ?? item.tagName}><td>{item.tagName}</td><td>{item.unresolvedCount}</td><td>{item.highRepeatCount}</td><td>{item.accuracy === null ? "无数据" : `${item.accuracy}%`}</td></tr>)}
          </tbody></table>
        </section>
      </StudentPage>
    </AppShell>
  );
}
