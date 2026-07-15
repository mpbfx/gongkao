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
  const foundationTag = Array.isArray(rawParams?.foundation) ? rawParams?.foundation[0] : rawParams?.foundation;
  const [tags, dailyPractice, foundation] = await Promise.all([
    listActiveTagsTree(),
    getTodayDailyPractice(user).catch(() => null),
    getFoundationProgress(user),
  ]);

  return (
    <AppShell>
      <StudentPage layout="wide" className="special-editorial-page">
        <PageHeader
          title="专项练习"
          summary={<span>选择一个知识点和本次题量</span>}
          secondaryActions={<DailyPracticeAction dailyPractice={dailyPractice} className="w-full md:w-auto" />}
        />

        <section>
          <SpecialPracticeBuilder tags={tags} />
        </section>

        <details open={Boolean(foundationTag)} className="group border-y border-foreground/40 bg-card/25">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            叶子类型筑基
            <span className="text-xs text-muted-foreground">{foundation.passedCount}/{foundation.totalCount} 已通过</span>
          </summary>
          <div className="border-t p-4"><FoundationTrainingPanel progress={foundation} initialTagId={foundationTag} /></div>
        </details>
      </StudentPage>
    </AppShell>
  );
}
