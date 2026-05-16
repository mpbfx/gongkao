import { CalendarCheck, ListChecks } from "lucide-react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
        <section className="flex flex-col gap-3">
          <Badge variant="secondary" className="w-fit">
            Phase 4
          </Badge>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">专项练习</h1>
            <p className="max-w-2xl text-muted-foreground">
              按知识点、题量和难度快速组卷，也可以从每日一练开始热身。
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck aria-hidden="true" />
                  每日一练
                </CardTitle>
                <CardDescription>
                  {dailyPractice
                    ? `${dailyPractice.title} · ${dailyPractice.questionCount} 题`
                    : "今日暂未配置"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dailyPractice?.isFallback ? (
                  <Badge variant="outline">使用最近一期</Badge>
                ) : (
                  <Badge variant="outline">今日练习</Badge>
                )}
              </CardContent>
              <CardFooter>
                <DailyPracticeAction dailyPractice={dailyPractice} className="w-full" />
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks aria-hidden="true" />
                  组卷规则
                </CardTitle>
                <CardDescription>
                  总题数至少 5 题；材料类专项需要单独练习；难度可不限制。
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <SpecialPracticeBuilder tags={tags} />
        </section>
      </main>
    </AppShell>
  );
}
