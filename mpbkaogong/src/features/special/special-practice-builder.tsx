"use client";

import { AlertTriangle, LoaderCircle, Play, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TagNode = {
  id: string;
  name: string;
  slug: string;
  isMaterialOnly: boolean;
  questionCount: number;
  children: TagNode[];
};

type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | {
      ok: false;
      data: null;
      error: { code: string; message: string; details: unknown };
    };

type CreateSessionResponse = {
  id: string;
};

const difficulties = [
  { label: "不限", value: "" },
  { label: "易", value: "EASY" },
  { label: "中", value: "MEDIUM" },
  { label: "难", value: "HARD" },
];

function flattenTags(tags: TagNode[]) {
  const result: TagNode[] = [];

  function visit(tag: TagNode) {
    result.push(tag);
    tag.children.forEach(visit);
  }

  tags.forEach(visit);
  return result;
}

function TagTree({
  tags,
  selected,
  onToggle,
  onCountChange,
  level = 0,
}: {
  tags: TagNode[];
  selected: Record<string, number>;
  onToggle: (tag: TagNode) => void;
  onCountChange: (tagId: string, count: number) => void;
  level?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      {tags.map((tag) => {
        const isSelected = selected[tag.id] !== undefined;

        return (
          <div key={tag.id} className={cn("flex flex-col gap-2", level > 0 && "pl-4")}>
            <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 md:flex-row md:items-center md:justify-between">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
                onClick={() => onToggle(tag)}
              >
                <span
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded border text-xs",
                    isSelected && "bg-primary text-primary-foreground"
                  )}
                  aria-hidden="true"
                >
                  {isSelected ? "✓" : ""}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium">{tag.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {tag.questionCount} 题{tag.isMaterialOnly ? " · 材料类" : ""}
                  </span>
                </span>
              </button>
              {isSelected ? (
                <div className="flex items-center gap-2 md:w-36">
                  <span className="text-sm text-muted-foreground">题量</span>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={selected[tag.id]}
                    onChange={(event) => onCountChange(tag.id, Number(event.target.value))}
                  />
                </div>
              ) : null}
            </div>
            {tag.children.length > 0 ? (
              <TagTree
                tags={tag.children}
                selected={selected}
                onToggle={onToggle}
                onCountChange={onCountChange}
                level={level + 1}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function SpecialPracticeBuilder({ tags }: { tags: TagNode[] }) {
  const router = useRouter();
  const flatTags = useMemo(() => flattenTags(tags), [tags]);
  const tagById = useMemo(() => new Map(flatTags.map((tag) => [tag.id, tag])), [flatTags]);
  const [difficulty, setDifficulty] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedTags = Object.keys(selected).map((tagId) => tagById.get(tagId)).filter(Boolean);
  const selectedCount = selectedTags.length;
  const totalCount = Object.values(selected).reduce((total, count) => total + count, 0);
  const hasMaterialMix = selectedTags.some((tag) => tag?.isMaterialOnly) && selectedTags.length > 1;

  function toggleTag(tag: TagNode) {
    setMessage(null);
    setSelected((current) => {
      if (current[tag.id] !== undefined) {
        const next = { ...current };
        delete next[tag.id];
        return next;
      }

      return {
        ...current,
        [tag.id]: Math.min(10, Math.max(5, tag.questionCount || 5)),
      };
    });
  }

  function updateCount(tagId: string, count: number) {
    setSelected((current) => ({
      ...current,
      [tagId]: Number.isFinite(count) ? Math.min(100, Math.max(1, count)) : 1,
    }));
  }

  async function startSpecialPractice() {
    setMessage(null);

    if (selectedCount === 0) {
      setMessage("请先选择至少一个专项分类。");
      return;
    }

    if (totalCount < 5) {
      setMessage("预估总题数太少了，至少需要 5 题。");
      return;
    }

    if (hasMaterialMix) {
      setMessage("材料类专项不能和其他专项混练。");
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch("/api/practice/sessions/special", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "SPECIAL",
          difficulty: difficulty || null,
          reqs: Object.entries(selected).map(([tagId, num]) => ({ tagId, num })),
        }),
      });
      const payload = (await response.json()) as ApiResponse<CreateSessionResponse>;

      if (!payload.ok) {
        if (payload.error.code === "UNAUTHORIZED") {
          router.push("/login?callbackUrl=/question-bank/special");
          return;
        }

        setMessage(payload.error.message);
        return;
      }

      router.push(`/practice/${payload.data.id}`);
    } catch {
      setMessage("创建专项练习失败，请稍后重试。");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>练习条件</CardTitle>
          <CardDescription>选择难度、知识点和题量后开始组卷。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium">难度</div>
            <div className="grid grid-cols-4 rounded-lg border bg-muted p-1">
              {difficulties.map((item) => (
                <button
                  key={item.value || "ALL"}
                  type="button"
                  className={cn(
                    "h-8 rounded-md text-sm transition-colors",
                    difficulty === item.value && "bg-background shadow-sm"
                  )}
                  onClick={() => setDifficulty(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {message ? (
            <Alert variant={hasMaterialMix ? "destructive" : "default"}>
              <AlertTriangle aria-hidden="true" />
              <AlertTitle>无法开始</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          {hasMaterialMix ? (
            <Alert variant="destructive">
              <AlertTriangle aria-hidden="true" />
              <AlertTitle>材料类混选</AlertTitle>
              <AlertDescription>材料类专项需要单独练习，请取消其他分类后再开始。</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>专项分类</CardTitle>
          <CardDescription>已选 {selectedCount} 类，预计 {totalCount} 题。</CardDescription>
        </CardHeader>
        <CardContent>
          <TagTree tags={tags} selected={selected} onToggle={toggleTag} onCountChange={updateCount} />
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-16 border-t bg-background p-3 lg:static lg:border-0 lg:p-0">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">
              已选 {selectedCount} 类 · {totalCount} 题
            </div>
            <div className="text-xs text-muted-foreground">
              {difficulty ? `难度 ${difficulty}` : "难度不限"}
            </div>
          </div>
          <Button type="button" variant="outline" disabled={isPending || selectedCount === 0} onClick={() => setSelected({})}>
            <RotateCcw data-icon="inline-start" />
            清空
          </Button>
          <Button type="button" disabled={isPending || selectedCount === 0 || hasMaterialMix} onClick={startSpecialPractice}>
            {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Play data-icon="inline-start" />}
            开始练习
          </Button>
        </div>
      </div>

      <div className="h-36 lg:hidden" />
    </div>
  );
}

export type { TagNode };
