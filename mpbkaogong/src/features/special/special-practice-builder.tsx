"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Play,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
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

type VisibleTagNode = Omit<TagNode, "children"> & {
  children: VisibleTagNode[];
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

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function tagMatches(tag: TagNode, query: string) {
  return tag.name.toLowerCase().includes(query) || tag.slug.toLowerCase().includes(query);
}

function filterTags(tags: TagNode[], query: string): VisibleTagNode[] {
  if (!query) {
    return tags;
  }

  return tags.flatMap((tag) => {
    const filteredChildren = filterTags(tag.children, query);

    if (tagMatches(tag, query) || filteredChildren.length > 0) {
      return [{ ...tag, children: filteredChildren }];
    }

    return [];
  });
}

function isTagNode(value: TagNode | undefined): value is TagNode {
  return Boolean(value);
}

function TagTree({
  tags,
  selected,
  expanded,
  forceExpanded = false,
  onToggle,
  onToggleExpand,
  level = 0,
}: {
  tags: VisibleTagNode[];
  selected: Record<string, number>;
  expanded: Set<string>;
  forceExpanded?: boolean;
  onToggle: (tag: TagNode) => void;
  onToggleExpand: (tagId: string) => void;
  level?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      {tags.map((tag) => {
        const isSelected = selected[tag.id] !== undefined;
        const hasChildren = tag.children.length > 0;
        const isExpanded = forceExpanded || expanded.has(tag.id);
        const childrenId = `tag-children-${tag.id}`;

        return (
          <div key={tag.id} className={cn("flex flex-col gap-2", level > 0 && "pl-4")}>
            <div className="flex items-start gap-2 rounded-lg border bg-card p-2 md:items-center">
              {hasChildren ? (
                <button
                  type="button"
                  className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:size-8"
                  aria-label={isExpanded ? `收起 ${tag.name}` : `展开 ${tag.name}`}
                  aria-expanded={isExpanded}
                  aria-controls={childrenId}
                  onClick={() => onToggleExpand(tag.id)}
                >
                  {isExpanded ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
                </button>
              ) : (
                <span className="size-11 shrink-0 lg:size-8" aria-hidden="true" />
              )}
              <button
                type="button"
                className={cn(
                  "flex min-h-11 min-w-0 flex-1 items-start gap-3 rounded-md px-2 py-1 text-left outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  isSelected && "bg-primary/10"
                )}
                aria-pressed={isSelected}
                onClick={() => onToggle(tag)}
              >
                <span
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded border text-xs",
                    isSelected && "bg-primary text-primary-foreground"
                  )}
                  aria-hidden="true"
                >
                  {isSelected ? <Check className="size-3" /> : null}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium">{tag.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {tag.questionCount} 题{tag.isMaterialOnly ? " · 材料类" : ""}
                  </span>
                </span>
              </button>
            </div>
            {hasChildren && isExpanded ? (
              <TagTree
                key={childrenId}
                tags={tag.children}
                selected={selected}
                expanded={expanded}
                forceExpanded={forceExpanded}
                onToggle={onToggle}
                onToggleExpand={onToggleExpand}
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
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const normalizedSearch = normalizeSearch(searchQuery);
  const visibleTags = useMemo(() => filterTags(tags, normalizedSearch), [normalizedSearch, tags]);
  const selectedTags = Object.keys(selected).map((tagId) => tagById.get(tagId)).filter(isTagNode);
  const selectedCount = selectedTags.length;
  const totalCount = Object.values(selected).reduce((total, count) => total + count, 0);
  const hasMaterialMix = selectedTags.some((tag) => tag?.isMaterialOnly) && selectedTags.length > 1;
  const resultCount = normalizedSearch ? visibleTags.length : tags.length;

  function toggleExpand(tagId: string) {
    setExpanded((current) => {
      const next = new Set(current);

      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }

      return next;
    });
  }

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
            <div className="grid grid-cols-4 rounded-lg border bg-muted p-1" role="group" aria-label="选择难度">
              {difficulties.map((item) => (
                <button
                  key={item.value || "ALL"}
                  type="button"
                  aria-pressed={difficulty === item.value}
                  className={cn(
                    "h-11 rounded-md text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 lg:h-8",
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
            <Alert variant={hasMaterialMix ? "destructive" : "warning"}>
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
          <CardDescription>
            {normalizedSearch ? `已显示 ${resultCount} 组匹配分类。` : "默认只显示顶层分类，展开后选择更细的知识点。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">搜索分类</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9 pr-11"
                placeholder="输入知识点名称"
                type="search"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:size-7"
                  aria-label="清空分类搜索"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </label>

          {selectedCount > 0 ? (
            <section className="rounded-lg border bg-muted/40 p-3" aria-label="已选专项">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium">已选专项</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedCount} 类 · {totalCount} 题，可在这里调整题量。
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelected({})}>
                  <RotateCcw data-icon="inline-start" />
                  清空
                </Button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {selectedTags.map((tag) => (
                  <div key={tag.id} className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{tag.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {tag.questionCount} 题{tag.isMaterialOnly ? " · 材料类" : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:w-40">
                      <span className="text-sm text-muted-foreground">题量</span>
                      <Input
                        aria-label={`${tag.name} 题量`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={100}
                        value={selected[tag.id]}
                        onChange={(event) => updateCount(tag.id, Number(event.target.value))}
                      />
                      <button
                        type="button"
                        className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:size-8"
                        aria-label={`取消选择 ${tag.name}`}
                        onClick={() => toggleTag(tag)}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {visibleTags.length > 0 ? (
            <TagTree
              tags={visibleTags}
              selected={selected}
              expanded={expanded}
              forceExpanded={Boolean(normalizedSearch)}
              onToggle={toggleTag}
              onToggleExpand={toggleExpand}
            />
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/40 p-6 text-center">
              <p className="text-sm font-medium">没有匹配的专项分类</p>
              <p className="mt-1 text-sm text-muted-foreground">换一个关键词，或清空搜索后从顶层分类展开。</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t bg-background/95 p-3 shadow-[0_-8px_24px_rgb(15_23_42/0.08)] backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
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
