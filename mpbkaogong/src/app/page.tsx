import { ArrowRight, BarChart3, BookOpen, CalendarCheck, ClipboardList } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DailyPracticeAction } from "@/features/daily-practice/daily-practice-action";
import { getCurrentUser } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { getTodayDailyPractice } from "@/server/services/daily-practice";

const quickStarts = [
  {
    title: "历年试卷",
    description: "先跑通真实试卷刷题闭环。",
    href: "/question-bank/papers",
    icon: ClipboardList,
    status: "Phase 2",
  },
  {
    title: "专项练习",
    description: "按知识点、题量和难度快速组卷。",
    href: "/question-bank/special",
    icon: BookOpen,
    status: "Phase 4",
  },
  {
    title: "练习记录",
    description: "查看已提交练习并进入历史回看。",
    href: "/question-bank/records",
    icon: BarChart3,
    status: "Phase 3",
  },
];

export default async function Home() {
  const user = await getCurrentUser();
  const dailyPractice = await getTodayDailyPractice(user).catch(() => null);

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
        <section className="flex flex-col gap-4">
          <Badge variant="secondary" className="w-fit">
            P1 认证与基础数据
          </Badge>
          <div className="flex flex-col gap-3">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
              公考题库系统
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              已接入 Auth.js、Prisma、MySQL schema 和种子数据，下一步可以在真实题库上跑通刷题闭环。
            </p>
          </div>
        </section>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck aria-hidden="true" />
              每日一练
            </CardTitle>
            <CardDescription>
              {dailyPractice
                ? `${dailyPractice.title} · ${dailyPractice.questionCount} 题`
                : "今日暂未配置每日一练"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dailyPractice?.completedSession ? (
              <Badge variant="secondary">今日已完成</Badge>
            ) : dailyPractice?.isFallback ? (
              <Badge variant="outline">最近一期</Badge>
            ) : (
              <Badge variant="outline">今日入口</Badge>
            )}
          </CardContent>
          <CardFooter>
            <DailyPracticeAction dailyPractice={dailyPractice} className="w-full md:w-auto" />
          </CardFooter>
        </Card>

        <section className="grid gap-4 md:grid-cols-3">
          {quickStarts.map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon aria-hidden="true" />
                    {item.title}
                  </CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">{item.status}</Badge>
                </CardContent>
                <CardFooter>
                  {item.status === "Phase 2" || item.status === "Phase 3" || item.status === "Phase 4" ? (
                    <Link
                      href={item.href}
                      className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between")}
                    >
                      进入
                      <ArrowRight data-icon="inline-end" />
                    </Link>
                  ) : (
                    <Button variant="outline" disabled className="w-full justify-between">
                      {item.status === "Phase 2" ? "进入" : "即将实现"}
                      <ArrowRight data-icon="inline-end" />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </section>
      </main>
    </AppShell>
  );
}
