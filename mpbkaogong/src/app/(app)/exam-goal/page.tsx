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
      <StudentPage wide>
        <PageHeader
          eyebrow="备考目标"
          title="先确定考试，再建立真实 benchmark"
          description="目标考试决定基准试卷和后续训练顺序。更换目标不会清除已有练习、错题和知识点记录。"
        />
        <ExamGoalWorkspace papers={papers} goal={goal} />
      </StudentPage>
    </AppShell>
  );
}
