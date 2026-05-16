import { FileUp } from "lucide-react";
import { revalidatePath } from "next/cache";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { requireAdmin } from "@/lib/auth/guards";
import { importQuestionsFromFile, listAdminImportJobs } from "@/server/services/admin";

async function importQuestionsAction(formData: FormData) {
  "use server";

  const user = await requireAdmin();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return;
  }

  await importQuestionsFromFile(user, file);
  revalidatePath("/admin/imports");
  revalidatePath("/admin/questions");
}

function errorText(errorJson: unknown) {
  if (!errorJson) {
    return null;
  }

  if (Array.isArray(errorJson)) {
    return errorJson
      .slice(0, 3)
      .map((item) => {
        if (item && typeof item === "object" && "row" in item && "message" in item) {
          return `第 ${String(item.row)} 行：${String(item.message)}`;
        }

        return JSON.stringify(item);
      })
      .join("；");
  }

  return JSON.stringify(errorJson);
}

export default async function AdminImportsPage() {
  const jobs = await listAdminImportJobs();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
      <section className="flex flex-col gap-2">
        <Badge variant="secondary" className="w-fit">
          批量导入
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">导入题目</h1>
        <p className="max-w-2xl text-muted-foreground">
          支持 JSON 或 CSV。导入会创建 ImportJob，并记录成功、失败行数与错误原因。
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>上传文件</CardTitle>
          <CardDescription>
            JSON 可传题目对象数组；CSV 表头支持 type,titleHtml,correctAnswer,analysisHtml,difficulty,tagId,source,optionA...
          </CardDescription>
        </CardHeader>
        <form action={importQuestionsAction}>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="file">题目文件</FieldLabel>
                <input
                  id="file"
                  name="file"
                  type="file"
                  accept=".json,.csv,application/json,text/csv"
                  required
                  className="w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm"
                />
                <FieldDescription>导入不会覆盖既有题目；每行会创建新的题目记录。</FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit">
              <FileUp data-icon="inline-start" />
              开始导入
            </Button>
          </CardFooter>
        </form>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">最近导入</h2>
        {jobs.map((job) => (
          <Card key={job.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <CardTitle className="truncate">{job.filename}</CardTitle>
                  <CardDescription>
                    {job.type} · {new Date(job.createdAt).toLocaleString("zh-CN")}
                  </CardDescription>
                </div>
                <Badge variant={job.status === "SUCCESS" ? "secondary" : "outline"}>{job.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-4">
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-muted-foreground">总行数</div>
                <div className="font-medium">{job.totalRows}</div>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-muted-foreground">成功</div>
                <div className="font-medium">{job.successRows}</div>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-muted-foreground">失败</div>
                <div className="font-medium">{job.failedRows}</div>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <div className="text-muted-foreground">状态</div>
                <div className="font-medium">{job.status}</div>
              </div>
            </CardContent>
            {errorText(job.errorJson) ? (
              <CardFooter>
                <p className="text-sm text-destructive">{errorText(job.errorJson)}</p>
              </CardFooter>
            ) : null}
          </Card>
        ))}
      </section>
    </main>
  );
}
