"use client";

import { Check, ChevronDown, ChevronRight, LoaderCircle, Play, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/student/interaction-overlays";
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
    <div className={cn("flex flex-col", level === 0 && "border border-foreground/25")}>
      {tags.map((tag) => {
        const hasChildren = tag.children.length > 0;
        const isExpanded = forceExpanded || expanded.has(tag.id);
        const isSelected = selectedId === tag.id;

        return (
          <div key={tag.id} className="flex flex-col">
            <div
              className={cn(
                "flex items-center gap-1 border-b border-foreground/15 last:border-b-0",
                level > 0 && "bg-muted/15",
                isSelected && "bg-primary/8 shadow-[inset_3px_0_0_var(--primary)]"
              )}
              style={level > 0 ? { paddingLeft: `${level * 0.75}rem` } : undefined}
            >
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
                  "flex min-h-11 min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  hasChildren && "cursor-default",
                  !hasChildren && "hover:bg-muted/40",
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
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false);
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
    setMobileConfigOpen(window.matchMedia("(max-width: 1023px)").matches);
  }

  async function startSpecialPractice() {
    if (!selected || actualCount <= 0) return;
    setIsPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/practice/sessions/special", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocol: "CUSTOM", tagId: selected.id, count: actualCount }),
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

  const trainingSetup = selected ? (
    <>
      <h3 className="student-heading text-2xl font-semibold">{selected.name}</h3>
      <p className="mt-2 text-sm text-muted-foreground">当前可用 {selected.questionCount} 题</p>
      <div className="mt-6">
        <div className="mb-2 text-sm font-medium">本次题量</div>
        <div className="grid grid-cols-3 gap-2">
          {[5, 10, 20].map((preset) => (
            <Button key={preset} type="button" variant={count === preset ? "default" : "outline"} size="sm" onClick={() => setCount(preset)}>
              {preset} 题
            </Button>
          ))}
        </div>
        {actualCount < count ? <p className="mt-2 text-xs text-muted-foreground">库存不足，本次使用 {actualCount} 题。</p> : null}
      </div>
      <Button type="button" className="mt-7 h-12 w-full" disabled={isPending || actualCount <= 0} onClick={startSpecialPractice}>
        {isPending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Play data-icon="inline-start" />}
        {isPending ? "正在创建" : `开始 ${actualCount} 题`}
      </Button>
      {message ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>创建失败</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
    </>
  ) : null;

  return (
    <section className="special-editorial-workspace w-full overflow-hidden border-y-2 border-foreground bg-card/45">
      <header className="border-b border-foreground/35 px-4 py-4 md:px-5">
        <h2 className="student-heading text-xl font-semibold">自由组卷</h2>
        <p className="mt-1 text-sm text-muted-foreground">每次选一个叶子知识点，题量不超过当前库存。</p>
      </header>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 p-4 md:p-5">
          <label className="mb-4 block">
            <span className="sr-only">搜索知识点</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9 pr-11"
                placeholder="搜索知识点"
                type="search"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center text-muted-foreground hover:text-foreground"
                  aria-label="清空搜索"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          </label>

          <div className="max-h-[32rem] overflow-y-auto pr-1">
            {visibleTags.length > 0 ? (
              <TagTree
                tags={visibleTags}
                selectedId={selected?.id}
                expanded={expanded}
                forceExpanded={Boolean(normalizedSearch)}
                onSelect={selectTag}
                onToggleExpand={toggleExpand}
              />
            ) : (
              <div className="border border-dashed p-8 text-center text-sm text-muted-foreground">
                没有匹配的知识点。
              </div>
            )}
          </div>
        </div>

        <aside className="hidden border-l border-foreground/30 bg-muted/20 p-5 lg:block">
          <span className="mb-4 block text-xs font-semibold tracking-[0.12em] text-muted-foreground">
            本次训练
          </span>
          {trainingSetup ?? (
            <div className="border border-dashed border-foreground/25 p-4 text-sm leading-6 text-muted-foreground">
              选择一个具体知识点后设置题量。
            </div>
          )}
        </aside>
      </div>

      <BottomSheet
        open={mobileConfigOpen && Boolean(selected)}
        onOpenChange={setMobileConfigOpen}
        title="本次训练"
        description="确认知识点和题量后开始练习。"
        className="lg:hidden"
      >
        <div className="p-4">{trainingSetup}</div>
      </BottomSheet>
    </section>
  );
}
