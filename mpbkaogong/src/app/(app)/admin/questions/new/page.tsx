import { redirect } from "next/navigation";

import { QuestionForm } from "@/components/admin/admin-forms";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminQuestion, questionInputFromFormData } from "@/server/services/admin";
import { listActiveTagsFlat } from "@/server/services/tags";

async function createQuestionAction(formData: FormData) {
  "use server";

  await requireAdmin();
  const question = await createAdminQuestion(questionInputFromFormData(formData));
  redirect(`/admin/questions/${question.id}`);
}

export default async function NewAdminQuestionPage() {
  const tags = await listActiveTagsFlat();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
      <section className="flex flex-col gap-2">
        <Badge variant="secondary" className="w-fit">
          新建题目
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">创建题目</h1>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>题目信息</CardTitle>
          <CardDescription>支持单选、多选、判断题；题干和解析可填写基础 HTML。</CardDescription>
        </CardHeader>
        <CardContent>
          <QuestionForm action={createQuestionAction} tags={tags} submitLabel="创建题目" />
        </CardContent>
      </Card>
    </main>
  );
}
