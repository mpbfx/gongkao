import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { StudentPage } from "@/components/student/page-building-blocks";
import { WrongReviewWorkspace } from "@/features/wrong-questions/wrong-review-workspace";
import { requireUser } from "@/lib/auth/guards";
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
  const highRepeatCount = data.groups.reduce(
    (total, group) => total + group.items.filter((item) => item.wrongCount >= 2 && !item.resolvedAt).length,
    0
  );

  return (
    <AppShell
      header={{
        title: "错题复盘工作台",
      }}
    >
      <StudentPage wide className="gap-3 py-3 xl:max-w-none xl:px-3 2xl:px-5">
        <WrongReviewWorkspace
          data={data}
          highRepeatCount={highRepeatCount}
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
