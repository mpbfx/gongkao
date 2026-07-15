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
      <StudentPage layout="workspace" className="gap-3 py-4 lg:py-4">
        <PageHeader
          compact
          title="课程知识问答"
          summary={<span>回答依据已导入课程字幕，并保留视频定位</span>}
        />
        <KnowledgeWorkspace initialSessions={sessions} initialPrompt={initialPrompt} />
      </StudentPage>
    </AppShell>
  );
}
