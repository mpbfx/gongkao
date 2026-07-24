import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import {
  PageHeader,
  StudentPage,
} from "@/components/student/page-building-blocks";
import { DailyPracticeAction } from "@/features/daily-practice/daily-practice-action";
import { SpecialPracticeBuilder } from "@/features/special/special-practice-builder";
import { FoundationTrainingPanel } from "@/features/special/foundation-training-panel";
import { requireUser } from "@/lib/auth/guards";
import { getTodayDailyPractice } from "@/server/services/daily-practice";
import { listActiveTagsTree } from "@/server/services/tags";
import { getFoundationProgress } from "@/server/services/foundation-training";

export default async function SpecialPracticePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser().catch(() => null);

  if (!user) {
    redirect("/login?callbackUrl=/question-bank/special");
  }

  const rawParams = await searchParams;
  const foundationTag = Array.isArray(rawParams?.foundation)
    ? rawParams?.foundation[0]
    : rawParams?.foundation;
  const [tags, dailyPractice, foundation] = await Promise.all([
    listActiveTagsTree(),
    getTodayDailyPractice(user).catch(() => null),
    getFoundationProgress(user),
  ]);

  return (
    <AppShell>
      <StudentPage layout="wide" className="special-editorial-page gap-6">
        <PageHeader
          eyebrow="专项提分"
          title="专项练习"
          description="自由组卷按知识点突破；叶子筑基按 15 题一轮推进基础通过线。"
          summary={<span>筑基进度 {foundation.passedCount}/{foundation.totalCount}</span>}
          secondaryActions={
            <DailyPracticeAction dailyPractice={dailyPractice} className="w-full md:w-auto" />
          }
        />

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="min-w-0">
            <SpecialPracticeBuilder tags={tags} />
          </div>

          <section
            id="foundation"
            className="min-w-0 border-y-2 border-foreground bg-card/40 xl:border-y-0 xl:border-l xl:border-foreground/30 xl:pl-6"
          >
            <div className="mb-4 flex items-end justify-between gap-3 border-b border-foreground/25 pb-3 xl:border-b-0 xl:pb-0">
              <div>
                <div className="text-xs font-semibold tracking-[0.14em] text-primary">叶子类型筑基</div>
                <h2 className="student-heading mt-1 text-xl font-semibold">按题型打通 9/15</h2>
              </div>
              <span className="text-sm text-muted-foreground">
                {foundation.passedCount}/{foundation.totalCount} 已通过
              </span>
            </div>
            <FoundationTrainingPanel progress={foundation} initialTagId={foundationTag} />
          </section>
        </section>
      </StudentPage>
    </AppShell>
  );
}
