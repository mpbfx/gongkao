import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PracticeRunner } from "@/features/practice/practice-runner";
import { requireUser } from "@/lib/auth/guards";
import { getPracticeSessionDetail } from "@/server/services/practice";

type PracticePageProps = {
  params: Promise<{
    sessionId: string;
  }>;
  searchParams?: Promise<{
    review?: string;
  }>;
};

export default async function PracticePage({ params, searchParams }: PracticePageProps) {
  const { sessionId } = await params;
  const query = await searchParams;
  const user = await requireUser().catch(() => null);

  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/practice/${sessionId}`)}`);
  }

  const session = await getPracticeSessionDetail(user, sessionId);

  return (
    <AppShell>
      <PracticeRunner initialSession={session} reviewMode={query?.review === "1"} />
    </AppShell>
  );
}
