import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import {
  PageHeader,
  StudentPage,
} from "@/components/student/page-building-blocks";
import { DailyPracticeAction } from "@/features/daily-practice/daily-practice-action";
import { SpecialPracticeBuilder } from "@/features/special/special-practice-builder";
import { requireUser } from "@/lib/auth/guards";
import { getTodayDailyPractice } from "@/server/services/daily-practice";
import { listActiveTagsTree } from "@/server/services/tags";

export default async function SpecialPracticePage() {
  const user = await requireUser().catch(() => null);

  if (!user) {
    redirect("/login?callbackUrl=/question-bank/special");
  }

  const [tags, dailyPractice] = await Promise.all([
    listActiveTagsTree(),
    getTodayDailyPractice(user).catch(() => null),
  ]);

  return (
    <AppShell>
      <StudentPage>
        <PageHeader
          eyebrow="专项提分"
          title="按知识点组一套更精准的练习"
          description="选择知识点和题量，系统会生成一组适合集中突破的训练。"
          actions={<DailyPracticeAction dailyPractice={dailyPractice} className="w-full md:w-auto" />}
        />

        <section>
          <SpecialPracticeBuilder tags={tags} />
        </section>
      </StudentPage>
    </AppShell>
  );
}
