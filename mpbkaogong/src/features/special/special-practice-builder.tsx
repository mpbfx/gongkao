"use client";

import { Check, ChevronDown, ChevronRight, LoaderCircle, Play, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  filterTags,
  normalizeTagSearch,
  type TagNode,
  type VisibleTagNode,
} from "@/features/special/special-practice-utils";
import { cn } from "@/lib/utils";

type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: { code: string; message: string; details: unknown } };

type SelectedTag = Pick<TagNode, "id" | "name" | "questionCount">;

function TagTree({
  tags,
  selectedId,
  expanded,
  forceExpanded,
  onSelect,
  onToggleExpand,
  level = 0,
}: {
  tags: VisibleTagNode[];
  selectedId?: string;
  expanded: Set<string>;
  forceExpanded: boolean;
  onSelect: (tag: TagNode) => void;
  onToggleExpand: (tagId: string) => void;
  level?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      {tags.map((tag) => {
        const hasChildren = tag.children.length > 0;
        const isExpanded = forceExpanded || expanded.has(tag.id);
        const isSelected = selectedId === tag.id;

        return (
          <div key={tag.id} className={cn("flex flex-col gap-2", level > 0 && "pl-4")}>
            <div className="flex items-center gap-2 border bg-card p-2">
              {hasChildren ? (
                <button
                  type="button"
                  className="grid size-10 shrink-0 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={isExpanded ? `收起 ${tag.name}` : `展开 ${tag.name}`}
                  aria-expanded={isExpanded}
                  onClick={() => onToggleExpand(tag.id)}
                >
                  {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
              ) : <span className="size-10 shrink-0" aria-hidden="true" />}

              <button
                type="button"
                disabled={hasChildren || tag.questionCount === 0}
                className={cn(
                  "flex min-h-11 min-w-0 flex-1 items-center gap-3 px-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  hasChildren && "cursor-default",
                  !hasChildren && "hover:bg-muted/60",
                  isSelected && "bg-primary/10",
                  tag.questionCount === 0 && "opacity-45"
                )}
                aria-pressed={hasChildren ? undefined : isSelected}
                onClick={() => onSelect(tag)}
              >
                {!hasChildren ? (
                  <span className={cn("grid size-5 shrink-0 place-items-center border", isSelected && "border-primary bg-primary text-primary-foreground")}>
                    {isSelected ? <Check className="size-3" /> : null}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{tag.name}</span>
                  <span className="text-xs text-muted-foreground">{tag.questionCount} 题{hasChildren ? " · 展开选择具体知识点" : ""}</span>
                </span>
              </button>
            </div>

            {hasChildren && isExpanded ? (
              <TagTree
                tags={tag.children}
                selectedId={selectedId}
                expanded={expanded}
                forceExpanded={forceExpanded}
                onSelect={onSelect}
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
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<SelectedTag | null>(null);
  const [count, setCount] = useState(10);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const normalizedSearch = normalizeTagSearch(searchQuery);
  const visibleTags = useMemo(() => filterTags(tags, normalizedSearch), [normalizedSearch, tags]);
  const actualCount = selected ? Math.min(count, selected.questionCount) : 0;

  function toggleExpand(tagId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function selectTag(tag: TagNode) {
    if (tag.children.length > 0 || tag.questionCount === 0) return;
    setSelected({ id: tag.id, name: tag.name, questionCount: tag.questionCount });
    setCount(Math.min(10, tag.questionCount));
    setMessage(null);
  }

  async function startSpecialPractice() {
    if (!selected || actualCount <= 0) return;
    setIsPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/practice/sessions/special", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "SPECIAL", reqs: [{ tagId: selected.id, num: count }] }),
      });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;

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
    <Card className="mx-auto max-w-5xl overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle>选择一个知识点</CardTitle>
        <CardDescription>每次只练一个具体知识点，系统会按题库库存自动调整题量。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 pt-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <label className="mb-4 block">
            <span className="sr-only">搜索知识点</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="pl-9 pr-11" placeholder="搜索知识点" type="search" />
              {searchQuery ? (
                <button type="button" className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center text-muted-foreground hover:text-foreground" aria-label="清空搜索" onClick={() => setSearchQuery("")}>
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          </label>

          <div className="max-h-[34rem] overflow-y-auto pr-1">
            {visibleTags.length > 0 ? (
              <TagTree tags={visibleTags} selectedId={selected?.id} expanded={expanded} forceExpanded={Boolean(normalizedSearch)} onSelect={selectTag} onToggleExpand={toggleExpand} />
            ) : (
              <div className="border border-dashed p-8 text-center text-sm text-muted-foreground">没有匹配的知识点。</div>
            )}
          </div>
        </div>

        <aside className="border-t pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">本次训练</span>
          {selected ? (
            <>
              <h3 className="student-heading mt-3 text-2xl font-semibold">{selected.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">当前可用 {selected.questionCount} 题</p>
              <div className="mt-6">
                <div className="mb-2 text-sm font-medium">题量</div>
                <div className="grid grid-cols-3 gap-2">
                  {[5, 10, 20].map((preset) => (
                    <Button key={preset} type="button" variant={count === preset ? "default" : "outline"} size="sm" onClick={() => setCount(preset)}>
                      {preset} 题
                    </Button>
                  ))}
                </div>
                {actualCount < count ? <p className="mt-2 text-xs text-muted-foreground">库存不足时将自动生成 {actualCount} 题。</p> : null}
              </div>
              <Button type="button" className="mt-7 h-12 w-full" disabled={isPending || actualCount <= 0} onClick={startSpecialPractice}>
                {isPending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                {isPending ? "正在创建" : `开始 ${actualCount} 题`}
              </Button>
            </>
          ) : (
            <div className="mt-4 border border-dashed p-5 text-sm leading-6 text-muted-foreground">从左侧展开分类，选择一个具体知识点即可开始。</div>
          )}

          {message ? (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>无法开始</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          {selected ? <Badge variant="outline" className="mt-4">一次只练一个知识点</Badge> : null}
        </aside>
      </CardContent>
    </Card>
  );
}
