import { revalidatePath } from "next/cache";
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
import {
  getAdminQuestion,
  questionInputFromFormData,
  updateAdminQuestion,
} from "@/server/services/admin";
import { listActiveTagsFlat } from "@/server/services/tags";

type EditAdminQuestionPageProps = {
  params: Promise<{
    questionId: string;
  }>;
};

export default async function EditAdminQuestionPage({ params }: EditAdminQuestionPageProps) {
  const { questionId } = await params;
  const [question, tags] = await Promise.all([getAdminQuestion(questionId), listActiveTagsFlat()]);

  async function updateQuestionAction(formData: FormData) {
    "use server";

    await requireAdmin();
    await updateAdminQuestion(questionId, questionInputFromFormData(formData));
    revalidatePath("/admin/questions");
    revalidatePath(`/admin/questions/${questionId}`);
    redirect(`/admin/questions/${questionId}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
      <section className="flex flex-col gap-2">
        <Badge variant="secondary" className="w-fit">
          编辑题目
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">维护题目</h1>
        <p className="text-sm text-muted-foreground">{question.id}</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>题目信息</CardTitle>
          <CardDescription>保存后会影响后续练习，新建 session 会读取最新题目。</CardDescription>
        </CardHeader>
        <CardContent>
          <QuestionForm
            action={updateQuestionAction}
            tags={tags}
            question={question}
            submitLabel="保存题目"
          />
        </CardContent>
      </Card>
    </main>
  );
}
