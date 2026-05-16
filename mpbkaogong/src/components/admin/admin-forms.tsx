import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Action = (formData: FormData) => void | Promise<void>;

type TagOption = {
  id: string;
  name: string;
};

type QuestionFormValue = {
  type?: string;
  titleHtml?: string;
  analysisHtml?: string | null;
  correctAnswer?: string;
  difficulty?: string;
  tagId?: string | null;
  source?: string | null;
  isVipOnly?: boolean;
  isActive?: boolean;
  options?: Array<{
    label: string;
    value: string;
    contentHtml: string;
  }>;
};

type PaperFormValue = {
  title?: string;
  slug?: string;
  year?: number | null;
  province?: string | null;
  examType?: string | null;
  difficultyScore?: string | number | null;
  isVipOnly?: boolean;
  isActive?: boolean;
  questionsText?: string;
};

const inputClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const textareaClass =
  "min-h-24 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function SelectField({
  id,
  name,
  label,
  defaultValue,
  children,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select id={id} name={name} defaultValue={defaultValue} className={inputClass}>
        {children}
      </select>
    </Field>
  );
}

export function QuestionForm({
  action,
  tags,
  question,
  submitLabel,
}: {
  action: Action;
  tags: TagOption[];
  question?: QuestionFormValue;
  submitLabel: string;
}) {
  const optionByLabel = new Map(question?.options?.map((option) => [option.label, option]) ?? []);

  return (
    <form action={action} className="flex flex-col gap-6">
      <FieldGroup>
        <div className="grid gap-4 md:grid-cols-3">
          <SelectField id="type" name="type" label="题型" defaultValue={question?.type ?? "SINGLE"}>
            <option value="SINGLE">单选</option>
            <option value="MULTIPLE">多选</option>
            <option value="JUDGE">判断</option>
          </SelectField>
          <SelectField id="difficulty" name="difficulty" label="难度" defaultValue={question?.difficulty ?? "UNKNOWN"}>
            <option value="UNKNOWN">未知</option>
            <option value="EASY">简单</option>
            <option value="MEDIUM">中等</option>
            <option value="HARD">困难</option>
          </SelectField>
          <SelectField id="tagId" name="tagId" label="分类" defaultValue={question?.tagId ?? ""}>
            <option value="">未分类</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </SelectField>
        </div>

        <Field>
          <FieldLabel htmlFor="titleHtml">题干 HTML</FieldLabel>
          <textarea
            id="titleHtml"
            name="titleHtml"
            defaultValue={question?.titleHtml ?? ""}
            required
            className={cn(textareaClass, "min-h-32")}
          />
          <FieldDescription>支持基础富文本 HTML；脚本会在服务端清理。</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="analysisHtml">解析 HTML</FieldLabel>
          <textarea
            id="analysisHtml"
            name="analysisHtml"
            defaultValue={question?.analysisHtml ?? ""}
            className={textareaClass}
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="correctAnswer">正确答案</FieldLabel>
            <Input id="correctAnswer" name="correctAnswer" defaultValue={question?.correctAnswer ?? ""} required />
            <FieldDescription>多选用英文逗号分隔，例如 A,C,D。</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="source">来源</FieldLabel>
            <Input id="source" name="source" defaultValue={question?.source ?? ""} />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isVipOnly" defaultChecked={question?.isVipOnly ?? false} />
            会员题
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={question?.isActive ?? true} />
            前台可见
          </label>
        </div>
      </FieldGroup>

      <FieldGroup>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">选项</h2>
          <p className="text-sm text-muted-foreground">判断题可填 A/T 和 B/F；空选项不会保存。</p>
        </div>
        {["A", "B", "C", "D", "E", "F"].map((label) => {
          const option = optionByLabel.get(label);

          return (
            <div key={label} className="grid gap-3 md:grid-cols-[90px_1fr]">
              <Field>
                <FieldLabel htmlFor={`optionValue${label}`}>值 {label}</FieldLabel>
                <Input id={`optionValue${label}`} name={`optionValue${label}`} defaultValue={option?.value ?? label} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`optionContent${label}`}>选项 {label}</FieldLabel>
                <Input
                  id={`optionContent${label}`}
                  name={`optionContent${label}`}
                  defaultValue={option?.contentHtml?.replace(/<[^>]*>/g, "") ?? ""}
                />
              </Field>
            </div>
          );
        })}
      </FieldGroup>

      <div className="flex justify-end">
        <Button type="submit">
          <Save data-icon="inline-start" />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function PaperForm({
  action,
  paper,
  submitLabel,
}: {
  action: Action;
  paper?: PaperFormValue;
  submitLabel: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-6">
      <FieldGroup>
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="title">标题</FieldLabel>
            <Input id="title" name="title" defaultValue={paper?.title ?? ""} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="slug">Slug</FieldLabel>
            <Input id="slug" name="slug" defaultValue={paper?.slug ?? ""} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="year">年份</FieldLabel>
            <Input id="year" name="year" type="number" defaultValue={paper?.year ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="province">地区</FieldLabel>
            <Input id="province" name="province" defaultValue={paper?.province ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="examType">类型</FieldLabel>
            <Input id="examType" name="examType" defaultValue={paper?.examType ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="difficultyScore">难度分</FieldLabel>
            <Input id="difficultyScore" name="difficultyScore" type="number" step="0.1" defaultValue={paper?.difficultyScore ?? ""} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isVipOnly" defaultChecked={paper?.isVipOnly ?? false} />
            会员试卷
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={paper?.isActive ?? true} />
            前台可见
          </label>
        </div>
      </FieldGroup>

      <Field>
        <FieldLabel htmlFor="questionsText">题目顺序与模块</FieldLabel>
        <textarea
          id="questionsText"
          name="questionsText"
          defaultValue={paper?.questionsText ?? ""}
          required
          className={cn(textareaClass, "min-h-56 font-mono")}
          placeholder={"questionId | 常识判断 | 1\nquestionId | 言语理解 | 1"}
        />
        <FieldDescription>每行一道题，格式：题目 ID | 模块名称 | 分值。行号即题序。</FieldDescription>
      </Field>

      <div className="flex justify-end">
        <Button type="submit">
          <Save data-icon="inline-start" />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
