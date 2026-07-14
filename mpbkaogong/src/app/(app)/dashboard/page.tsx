import {
  ArrowRight,
  BarChart3,
  BookMarked,
  ChartNoAxesCombined,
  ClipboardList,
  Clock3,
  Grid3X3,
  Target,
  type LucideIcon,
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
import { getLearningSituation } from "@/server/services/learning-situation";
import { getExamGoal } from "@/server/services/exam-goals";
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

  const [situation, examGoal, foundation, nextAction] = await Promise.all([
    getLearningSituation(user),
    getExamGoal(user),
    getFoundationProgress(user),
    getNextTrainingAction(user),
  ]);
  const hasTrend = situation.accuracyTrend.length >= 2;
  const hasHeatmap = situation.knowledgeHeatmap.tags.length > 0;
  const hasModes = situation.modeComparison.length > 0;
  const hasWrongQuestions = situation.wrongSummary.totalCount > 0;
  const hasWeakKnowledge = situation.weakKnowledge.length > 0;

  const actionClass = cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-none px-3 text-xs lg:h-8");
  const panelActionClass = cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 text-[0.68rem]");
  const kpis: Array<{ label: string; value: string; suffix: string; icon: LucideIcon }> = [
    { label: "累计练习", value: String(situation.summary.totalSessions), suffix: "次", icon: ClipboardList },
    { label: "累计题量", value: String(situation.summary.totalQuestions), suffix: "题", icon: ChartNoAxesCombined },
    { label: "整体正确率", value: situation.summary.overallAccuracy ? `${situation.summary.overallAccuracy}%` : "—", suffix: `${situation.summary.correctCount} 题正确`, icon: Target },
    { label: "累计用时", value: formatDuration(situation.summary.totalElapsedSeconds), suffix: "已提交练习", icon: Clock3 },
    { label: "待复盘错题", value: String(situation.wrongSummary.unresolvedCount), suffix: "题", icon: BookMarked },
  ];

  return (
    <AppShell header={{ title: "学习情况", subtitle: "用真实练习记录持续校准" }}>
      <StudentPage wide className="learning-situation-page learning-dashboard gap-3 py-4 pb-24 lg:gap-3 lg:px-7 lg:py-4">
        <header className="learning-dashboard-header grid gap-3 border-b-2 border-foreground pb-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <div className="text-[0.62rem] font-semibold tracking-[0.26em] text-primary">LEARNING CONTROL DESK · 学习情况</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h1 className="student-heading text-2xl font-semibold tracking-tight md:text-3xl lg:text-[2.15rem]">学习分析总览</h1>
              <p className="text-xs text-muted-foreground">累计、趋势、分布与薄弱点均来自已提交练习</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="学习情况快捷操作">
            <Link href="/question-bank/wrong" className={actionClass}>复盘错题</Link>
            <Link href="/question-bank/special" className={actionClass}>按薄弱点组卷</Link>
            <Link href="/question-bank/papers?purpose=TIME_PRESSURE" className={actionClass}>减时模拟</Link>
            <Link href="/question-bank/records" className={actionClass}>查看历史记录</Link>
          </nav>
        </header>

        <section className="grid border-y-2 border-foreground bg-card/45 lg:grid-cols-[minmax(0,1fr)_16rem_16rem_auto]">
          <div className="border-b border-foreground/20 p-4 lg:border-b-0 lg:border-r">
            <div className="text-[0.65rem] tracking-[0.18em] text-muted-foreground">当前目标</div>
            <div className="student-heading mt-1 text-lg font-semibold">{examGoal?.targetPaper.title ?? "尚未设置目标考试"}</div>
          </div>
          <div className="border-b border-foreground/20 p-4 lg:border-b-0 lg:border-r">
            <div className="text-[0.65rem] tracking-[0.18em] text-muted-foreground">BENCHMARK</div>
            <div className="student-heading mt-1 text-lg font-semibold">{examGoal?.baselineSession ? `${examGoal.baselineSession.score ?? "0"}/${examGoal.baselineSession.maxScore ?? "0"} 分` : "待完成"}</div>
          </div>
          <div className="border-b border-foreground/20 p-4 lg:border-b-0 lg:border-r">
            <div className="text-[0.65rem] tracking-[0.18em] text-muted-foreground">筑基进度</div>
            <div className="student-heading mt-1 text-lg font-semibold">{foundation.passedCount}/{foundation.totalCount} 个叶子类型</div>
          </div>
          <div className="flex items-center p-4">
            <Link href={nextAction.href} className={cn(buttonVariants(), "w-full")}>{nextAction.label}<ArrowRight data-icon="inline-end" /></Link>
          </div>
        </section>

        <dl className="learning-kpi-strip grid grid-cols-2 overflow-hidden border-y-2 border-foreground sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map(({ label, value, suffix, icon: Icon }) => (
            <div key={label} className="flex min-w-0 items-center gap-2 border-b border-r border-foreground/25 px-3 py-2.5 sm:last:border-b-0 lg:border-b-0">
              <span className="grid size-7 shrink-0 place-items-center border border-foreground/20 bg-muted/60">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <dt className="truncate text-[0.65rem] text-muted-foreground">{label}</dt>
                <dd className="student-heading truncate text-lg font-semibold tabular-nums leading-none sm:text-xl">
                  {value}<span className="ml-1 font-sans text-[0.55rem] font-normal text-muted-foreground sm:text-[0.62rem]">{suffix}</span>
                </dd>
              </div>
            </div>
          ))}
        </dl>

        <div className="learning-dashboard-grid grid gap-3 lg:grid-cols-12">
          <DashboardPanel
            title="近期正确率"
            question="最近 12 次练习表现如何变化？"
            icon={BarChart3}
            className="lg:col-span-7 lg:h-[19rem]"
            bodyClassName="h-[calc(100%-2.75rem)]"
          >
            {hasTrend ? <AccuracyTrendChart data={situation.accuracyTrend} /> : <CompactEmpty>至少提交两次练习后才绘制趋势线。</CompactEmpty>}
          </DashboardPanel>

          <div className="grid min-w-0 gap-2 lg:col-span-5 lg:h-[19rem] lg:grid-rows-[10rem_minmax(0,1fr)]">
            <DashboardPanel
              title="训练类型对比"
              question="不同训练方式的题量和正确率有何差异？"
              icon={ChartNoAxesCombined}
              className="h-full"
              bodyClassName="h-[calc(100%-2.75rem)]"
            >
              {hasModes ? <PracticeModeChart data={situation.modeComparison} /> : <CompactEmpty>暂无可比较的训练类型。</CompactEmpty>}
            </DashboardPanel>

            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
              <DashboardPanel title="作答构成" icon={Target} compact className="h-full" bodyClassName="pt-0">
                {situation.summary.totalQuestions > 0 ? (
                  <AnswerCompositionChart
                    correctCount={situation.summary.correctCount}
                    wrongCount={situation.summary.wrongCount}
                    unansweredCount={situation.summary.unansweredCount}
                  />
                ) : <CompactEmpty>暂无作答数据。</CompactEmpty>}
              </DashboardPanel>
              <DashboardPanel title="错题消化" icon={BookMarked} compact className="h-full" bodyClassName="pt-0">
                {hasWrongQuestions ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center">
                    <WrongResolutionChart resolvedCount={situation.wrongSummary.resolvedCount} unresolvedCount={situation.wrongSummary.unresolvedCount} />
                    <dl className="border-l border-foreground/20 pl-2 text-[0.62rem] leading-5 text-muted-foreground">
                      <div><dt className="inline">已掌握 </dt><dd className="inline font-mono text-success">{situation.wrongSummary.resolvedCount}</dd></div>
                      <div><dt className="inline">待复盘 </dt><dd className="inline font-mono text-warning">{situation.wrongSummary.unresolvedCount}</dd></div>
                    </dl>
                  </div>
                ) : <CompactEmpty>暂无错题状态。</CompactEmpty>}
              </DashboardPanel>
            </div>
          </div>

          <DashboardPanel
            title="知识点热力图"
            question="最近八个自然周哪些知识点失分集中？“—”为无数据，“*”为样本少于三题。"
            icon={Grid3X3}
            className="lg:col-span-8 lg:h-[18rem]"
            bodyClassName="h-[calc(100%-2.75rem)]"
            action={<Link href="/question-bank/special" className={panelActionClass}>专项组卷<ArrowRight data-icon="inline-end" /></Link>}
          >
            {hasHeatmap ? <KnowledgeHeatmapChart {...situation.knowledgeHeatmap} /> : <CompactEmpty>近八周暂无知识点作答数据。</CompactEmpty>}
          </DashboardPanel>

          <DashboardPanel
            title="薄弱知识点排行"
            question="待复盘数 / 重复错误数 / 历史正确率"
            icon={Target}
            className="lg:col-span-4 lg:h-[18rem]"
            bodyClassName="h-[calc(100%-2.75rem)]"
            action={<Link href="/question-bank/wrong" className={panelActionClass}>进入错题<ArrowRight data-icon="inline-end" /></Link>}
          >
            {hasWeakKnowledge ? <WeakKnowledgeChart data={situation.weakKnowledge} /> : <CompactEmpty>当前没有待复盘知识点。</CompactEmpty>}
          </DashboardPanel>
        </div>

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
