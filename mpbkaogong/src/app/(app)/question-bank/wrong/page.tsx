import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Filter,
  Layers3,
  RotateCcw,
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
import { WrongReviewWorkspace } from "@/features/wrong-questions/wrong-review-workspace";
import { requireUser } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { getMistakeInsights } from "@/server/agent/mistakes/service";
import {
  listWrongQuestions,
  wrongQuestionsQuerySchema,
} from "@/server/services/wrong-questions";

type WrongQuestionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildWrongHref(input: {
  tagId?: string | null;
  includeResolved?: boolean;
  mistakeCause?: string | null;
  analysis?: "analyzed" | "unanalyzed" | "all";
}) {
  const params = new URLSearchParams();

  if (input.tagId) {
    params.set("tagId", input.tagId);
  }

  if (input.includeResolved) {
    params.set("includeResolved", "true");
  }

  if (input.mistakeCause) {
    params.set("mistakeCause", input.mistakeCause);
  }

  if (input.analysis && input.analysis !== "all") {
    params.set("analysis", input.analysis);
  }

  const query = params.toString();
  return `/question-bank/wrong${query ? `?${query}` : ""}`;
}

export default async function WrongQuestionsPage({ searchParams }: WrongQuestionsPageProps) {
  const user = await requireUser().catch(() => null);

  if (!user) {
    redirect("/login?callbackUrl=/question-bank/wrong");
  }

  const rawParams = await searchParams;
  const query = wrongQuestionsQuerySchema.parse({
    tagId: firstValue(rawParams?.tagId),
    mistakeCause: firstValue(rawParams?.mistakeCause),
    analysis: firstValue(rawParams?.analysis),
    includeResolved: firstValue(rawParams?.includeResolved),
  });
  const [data, mistakeInsights] = await Promise.all([
    listWrongQuestions(user, query),
    getMistakeInsights(user, { range: "30", includeResolved: query.includeResolved }),
  ]);
  const hasActiveFilters = Boolean(query.tagId || query.mistakeCause || query.analysis !== "all");
  const highRepeatCount = data.groups.reduce(
    (total, group) => total + group.items.filter((item) => item.wrongCount >= 2 && !item.resolvedAt).length,
    0
  );

  return (
    <AppShell>
      <StudentPage wide>
        <PageHeader
          eyebrow="错题本"
          title="错题复盘工作台"
          description="先定位最该处理的错题，再在固定详情面板里看解析、错因和助教追问。"
          actions={
            <>
              {hasActiveFilters ? (
                <Link href={buildWrongHref({ includeResolved: query.includeResolved })} className={cn(buttonVariants({ variant: "outline" }))}>
                  <Filter data-icon="inline-start" />
                  清空筛选
                </Link>
              ) : null}
              <Link href="/question-bank/wrong/insights" className={cn(buttonVariants({ variant: "outline" }))}>
                <BarChart3 data-icon="inline-start" />
                错因报告
              </Link>
              <Link
                href={buildWrongHref({
                  tagId: query.tagId,
                  includeResolved: !query.includeResolved,
                  mistakeCause: query.mistakeCause,
                  analysis: query.analysis,
                })}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <RotateCcw data-icon="inline-start" />
                {query.includeResolved ? "只看未掌握" : "包含已掌握"}
              </Link>
            </>
          }
        />

        <MetricStrip
          items={[
            {
              label: "未掌握",
              value: data.summary.unresolvedCount,
              description: "下一组错题练习来源",
              icon: AlertTriangle,
              tone: data.summary.unresolvedCount > 0 ? "warning" : "success",
            },
            {
              label: "已掌握",
              value: data.summary.resolvedCount,
              description: "累计标记掌握",
              icon: CheckCircle2,
              tone: "success",
            },
            {
              label: "知识点",
              value: data.groups.length,
              description: data.groups[0]?.tagName ?? "暂无分组",
              icon: Layers3,
              tone: "info",
            },
            {
              label: "重复错误",
              value: highRepeatCount,
              description: "错 2 次及以上",
              icon: Target,
              tone: highRepeatCount > 0 ? "destructive" : "success",
            },
          ]}
        />

        <WrongReviewWorkspace
          data={data}
          insights={mistakeInsights}
          query={{
            tagId: query.tagId,
            mistakeCause: query.mistakeCause,
            analysis: query.analysis,
            includeResolved: query.includeResolved,
          }}
        />
      </StudentPage>
    </AppShell>
  );
}
