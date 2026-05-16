import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guards";

export default async function DashboardPage() {
  const user = await requireUser().catch(() => null);

  if (!user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
        <section className="flex flex-col gap-3">
          <Badge variant="secondary" className="w-fit">
            P1 已登录
          </Badge>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">我的题库</h1>
            <p className="max-w-2xl text-muted-foreground">
              当前账号已通过 Auth.js 会话校验，可以继续进入练习、记录和错题等用户态能力。
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>账号</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{user.role}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>练习记录</CardTitle>
              <CardDescription>Phase 3 接入提交结果和历史复盘。</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>错题本</CardTitle>
              <CardDescription>Phase 4 后沉淀专项薄弱点。</CardDescription>
            </CardHeader>
          </Card>
        </section>
      </main>
    </AppShell>
  );
}

