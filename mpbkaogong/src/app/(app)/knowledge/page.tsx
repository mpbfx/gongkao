import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, StudentPage } from "@/components/student/page-building-blocks";
import { KnowledgeWorkspace } from "@/features/knowledge/knowledge-workspace";
import { requireUser } from "@/lib/auth/guards";
import { listKnowledgeSessions } from "@/server/agent/knowledge/service";
import { buildQuestionKnowledgePrompt } from "@/server/services/knowledge-context";

export default async function KnowledgePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login?callbackUrl=/knowledge");
  const rawParams = await searchParams;
  const questionId = Array.isArray(rawParams?.questionId) ? rawParams?.questionId[0] : rawParams?.questionId;
  const [sessions, initialPrompt] = await Promise.all([
    listKnowledgeSessions(user),
    buildQuestionKnowledgePrompt(user, questionId),
  ]);

  return (
    <AppShell header={{ title: "课程知识", subtitle: "从课程原文中检索并引用" }}>
      <StudentPage wide className="gap-3 py-4 lg:py-4">
        <PageHeader
          compact
          eyebrow="COURSE ARCHIVE · 课程知识"
          title="课程知识问答"
          description="答案严格依据已导入字幕，并保留分P、时间范围和原视频跳转。"
        />
        <KnowledgeWorkspace initialSessions={sessions} initialPrompt={initialPrompt} />
      </StudentPage>
    </AppShell>
  );
}
