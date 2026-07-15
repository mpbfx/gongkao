import { redirect } from "next/navigation";

import { PaperForm } from "@/components/admin/admin-forms";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminPaper, paperInputFromFormData } from "@/server/services/admin";

async function createPaperAction(formData: FormData) {
  "use server";

  await requireAdmin();
  const paper = await createAdminPaper(paperInputFromFormData(formData));
  redirect(`/admin/papers/${paper.id}`);
}

export default function NewAdminPaperPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
      <section className="flex flex-col gap-2">
        <Badge variant="secondary" className="w-fit">
          新建试卷
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">创建试卷</h1>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>试卷信息</CardTitle>
          <CardDescription>保存后前台试卷列表会显示启用状态的新试卷。</CardDescription>
        </CardHeader>
        <CardContent>
          <PaperForm action={createPaperAction} submitLabel="创建试卷" />
        </CardContent>
      </Card>
    </main>
  );
}
