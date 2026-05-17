import { Bot, Save } from "lucide-react";
import { revalidatePath } from "next/cache";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth/guards";
import { getCoachConfig, upsertCoachConfig } from "@/server/agent/shared/config";

async function saveAgentConfig(formData: FormData) {
  "use server";

  const user = await requireAdmin();

  await upsertCoachConfig(user, {
    recentSessionLimit: formData.get("recentSessionLimit"),
    recentDays: formData.get("recentDays"),
    minAnswersPerTag: formData.get("minAnswersPerTag"),
    maxRecommendations: formData.get("maxRecommendations"),
    slowTimeMultiplier: formData.get("slowTimeMultiplier"),
  });
  revalidatePath("/admin/agent");
}

export default async function AdminAgentPage() {
  await requireAdmin();
  const config = await getCoachConfig();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <Bot aria-hidden="true" />
            Agent 配置
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            配置学习教练诊断窗口和推荐阈值。配置缺失时服务端会使用默认值兜底。
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>学习教练</CardTitle>
          <CardDescription>默认使用近 20 场已提交练习和近 7 天趋势。</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveAgentConfig} className="flex flex-col gap-6">
            <FieldGroup>
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="recentSessionLimit">近场次数</FieldLabel>
                  <Input
                    id="recentSessionLimit"
                    name="recentSessionLimit"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={config.recentSessionLimit}
                  />
                  <FieldDescription>主判断使用的已提交练习场数。</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="recentDays">趋势天数</FieldLabel>
                  <Input
                    id="recentDays"
                    name="recentDays"
                    type="number"
                    min={1}
                    max={90}
                    defaultValue={config.recentDays}
                  />
                  <FieldDescription>用于判断近期趋势的数据窗口。</FieldDescription>
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="minAnswersPerTag">知识点最低答题数</FieldLabel>
                  <Input
                    id="minAnswersPerTag"
                    name="minAnswersPerTag"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={config.minAnswersPerTag}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="maxRecommendations">最多推荐数</FieldLabel>
                  <Input
                    id="maxRecommendations"
                    name="maxRecommendations"
                    type="number"
                    min={1}
                    max={10}
                    defaultValue={config.maxRecommendations}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="slowTimeMultiplier">耗时偏慢倍率</FieldLabel>
                  <Input
                    id="slowTimeMultiplier"
                    name="slowTimeMultiplier"
                    type="number"
                    min={1}
                    max={5}
                    step="0.1"
                    defaultValue={config.slowTimeMultiplier}
                  />
                </Field>
              </div>
            </FieldGroup>
            <div className="flex justify-end">
              <Button type="submit">
                <Save data-icon="inline-start" />
                保存配置
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

