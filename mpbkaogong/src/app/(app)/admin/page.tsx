import { Database, FileUp, HelpCircle, ScrollText } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { adminOverview } from "@/server/services/admin";

export default async function AdminPage() {
  const overview = await adminOverview();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
      <section className="flex flex-col gap-3">
        <Badge variant="secondary" className="w-fit">
          Phase 7
        </Badge>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">管理后台</h1>
          <p className="max-w-2xl text-muted-foreground">
            维护题目、试卷题序和导入任务，前台题库会直接读取这里发布的数据。
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle aria-hidden="true" />
              题目
            </CardTitle>
            <CardDescription>{overview.questionCount} 道</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/admin/questions" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              管理题目
            </Link>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText aria-hidden="true" />
              试卷
            </CardTitle>
            <CardDescription>{overview.paperCount} 套</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/admin/papers" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              管理试卷
            </Link>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database aria-hidden="true" />
              分类
            </CardTitle>
            <CardDescription>{overview.activeTagCount} 个启用</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp aria-hidden="true" />
              导入任务
            </CardTitle>
            <CardDescription>{overview.importJobCount} 次</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/admin/imports" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              批量导入
            </Link>
          </CardFooter>
        </Card>
      </section>
    </main>
  );
}
