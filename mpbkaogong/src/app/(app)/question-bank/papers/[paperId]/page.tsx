import { ArrowLeft, Clock, FileText, Gauge } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader, StatCard, StudentPage } from "@/components/student/page-building-blocks";
import { PaperStartButton } from "@/features/papers/paper-start-button";
import { requireUser } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { MembershipRequiredError, NotFoundError } from "@/server/services/errors";
import { getPaperDetail } from "@/server/services/papers";

type PaperDetailPageProps = {
  params: Promise<{
    paperId: string;
  }>;
};

export default async function PaperDetailPage({ params }: PaperDetailPageProps) {
  const { paperId } = await params;
  const user = await requireUser().catch(() => null);

  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/question-bank/papers/${paperId}`)}`);
  }

  const paper = await getPaperDetail(paperId, user).catch((error) => {
    if (error instanceof NotFoundError) {
      notFound();
    }

    if (error instanceof MembershipRequiredError) {
      return error;
    }

    throw error;
  });

  return (
    <AppShell>
      <StudentPage className="max-w-5xl">
        <Link href="/question-bank/papers" className={cn(buttonVariants({ variant: "ghost" }), "w-fit")}>
          <ArrowLeft data-icon="inline-start" />
          返回试卷
        </Link>

        {paper instanceof MembershipRequiredError ? (
          <Alert variant="destructive">
            <AlertTitle>需要会员权限</AlertTitle>
            <AlertDescription>{paper.message}</AlertDescription>
          </Alert>
        ) : (
          <>
            <PageHeader
              eyebrow="试卷详情"
              title={paper.title}
              description={[paper.year, paper.province, paper.examType].filter(Boolean).join(" / ")}
              actions={paper.isVipOnly ? <Badge>会员专属</Badge> : <Badge variant="secondary">可直接练习</Badge>}
            />

            <section className="grid gap-4 md:grid-cols-3">
              <StatCard title="题量" value={paper.questionCount} description="本套试卷总题数" icon={FileText} tone="info" />
              <StatCard title="预计用时" value={`${Math.max(10, paper.questionCount)}分`} description="按完整练习估算" icon={Clock} />
              <StatCard title="难度" value={paper.difficultyScore ?? "未评级"} description="题库综合评分" icon={Gauge} tone="warning" />
            </section>

            <Card>
              <CardHeader>
                <CardTitle>模块分布</CardTitle>
                <CardDescription>开始练习后，题目顺序会固定在本次练习中。</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {paper.model.map((section) => (
                  <div key={section.name} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                    <span className="font-medium">{section.name}</span>
                    <span className="font-mono text-sm text-muted-foreground tabular-nums">
                      {section.snum} - {section.enum} 题
                    </span>
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <PaperStartButton paperId={paper.id} className="w-full md:w-auto" />
              </CardFooter>
            </Card>
          </>
        )}
      </StudentPage>
    </AppShell>
  );
}
