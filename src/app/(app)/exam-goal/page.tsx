import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, StudentPage } from "@/components/student/page-building-blocks";
import { ExamGoalWorkspace } from "@/features/exam-goal/exam-goal-workspace";
import { requireUser } from "@/lib/auth/guards";
import { getExamGoal, listExamGoalPapers } from "@/server/services/exam-goals";

export default async function ExamGoalPage() {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login?callbackUrl=/exam-goal");
  const [papers, goal] = await Promise.all([listExamGoalPapers(), getExamGoal(user)]);

  return (
    <AppShell>
      <StudentPage layout="content">
        <PageHeader
          title="设置备考目标"
          summary={<span>目标考试决定基准试卷和后续训练顺序</span>}
        />
        <ExamGoalWorkspace papers={papers} goal={goal} />
      </StudentPage>
    </AppShell>
  );
}
