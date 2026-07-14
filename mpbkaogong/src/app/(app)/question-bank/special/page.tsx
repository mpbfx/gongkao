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
      <StudentPage wide className="special-editorial-page">
        <PageHeader
          eyebrow="专项提分"
          title="按知识点组一套更精准的练习"
          description="选择知识点和题量，系统会生成一组适合集中突破的训练。"
          actions={<DailyPracticeAction dailyPractice={dailyPractice} className="w-full md:w-auto" />}
        />

        <FoundationTrainingPanel progress={foundation} initialTagId={foundationTag} />

        <section className="mt-8">
          <h2 className="student-heading mb-4 text-xl font-semibold">自由专项练习</h2>
          <SpecialPracticeBuilder tags={tags} />
        </section>
      </StudentPage>
    </AppShell>
  );
}
