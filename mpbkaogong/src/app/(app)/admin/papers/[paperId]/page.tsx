import { revalidatePath } from "next/cache";
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
import { getAdminPaper, paperInputFromFormData, updateAdminPaper } from "@/server/services/admin";

type EditAdminPaperPageProps = {
  params: Promise<{
    paperId: string;
  }>;
};

export default async function EditAdminPaperPage({ params }: EditAdminPaperPageProps) {
  const { paperId } = await params;
  const paper = await getAdminPaper(paperId);

  async function updatePaperAction(formData: FormData) {
    "use server";

    await requireAdmin();
    await updateAdminPaper(paperId, paperInputFromFormData(formData));
    revalidatePath("/admin/papers");
    revalidatePath("/question-bank/papers");
    revalidatePath(`/admin/papers/${paperId}`);
    redirect(`/admin/papers/${paperId}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
      <section className="flex flex-col gap-2">
        <Badge variant="secondary" className="w-fit">
          编辑试卷
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">维护试卷</h1>
        <p className="text-sm text-muted-foreground">{paper.id}</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>试卷题序</CardTitle>
          <CardDescription>修改行顺序即可调整答题卡顺序；模块名称会生成试卷模型分组。</CardDescription>
        </CardHeader>
        <CardContent>
          <PaperForm action={updatePaperAction} paper={paper} submitLabel="保存试卷" />
        </CardContent>
      </Card>
    </main>
  );
}
