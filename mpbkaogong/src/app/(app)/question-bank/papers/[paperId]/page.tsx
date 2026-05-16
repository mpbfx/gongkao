import { ArrowLeft, Clock, FileText } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
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
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
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
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">试卷详情</Badge>
                {paper.isVipOnly ? <Badge>会员</Badge> : null}
              </div>
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">{paper.title}</h1>
                <p className="text-muted-foreground">
                  {[paper.year, paper.province, paper.examType].filter(Boolean).join(" / ")}
                </p>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText aria-hidden="true" />
                    题量
                  </CardTitle>
                  <CardDescription>{paper.questionCount} 题</CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock aria-hidden="true" />
                    预计用时
                  </CardTitle>
                  <CardDescription>{Math.max(10, paper.questionCount)} 分钟</CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>难度</CardTitle>
                  <CardDescription>{paper.difficultyScore ?? "未评级"}</CardDescription>
                </CardHeader>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>模块分布</CardTitle>
                <CardDescription>开始练习后题目顺序会固定在本次练习中。</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {paper.model.map((section) => (
                  <div key={section.name} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                    <span className="font-medium">{section.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {section.snum} - {section.enum} 题
                    </span>
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <PaperStartButton paperId={paper.id} className="w-full md:w-auto" />
              </CardFooter>
            </Card>

            <Separator />
          </>
        )}
      </main>
    </AppShell>
  );
}
