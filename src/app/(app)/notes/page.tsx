import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, StudentPage } from "@/components/student/page-building-blocks";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NotesWorkspace } from "@/features/notes/notes-workspace";
import { requireUser } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { listAgentNotes } from "@/server/agent/notes/service";
import { listActiveTagsFlat } from "@/server/services/tags";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NotesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login?callbackUrl=/notes");

  const raw = (await searchParams) ?? {};
  const query = {
    keyword: first(raw.keyword),
    source: first(raw.source),
    status: first(raw.status),
    tagId: first(raw.tagId),
    trashed: first(raw.trashed),
    page: first(raw.page),
    pageSize: first(raw.pageSize),
  };
  const [notes, tags] = await Promise.all([
    listAgentNotes(user, query),
    listActiveTagsFlat(),
  ]);
  const leafTags = tags
    .filter((tag) => tag.isLeaf)
    .map((tag) => ({ id: tag.id, name: tag.name, path: tag.path }));
  const queryString = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) => (value ? [[key, value]] : []))
  ).toString();

  return (
    <AppShell header={{ title: "学习笔记", subtitle: "收藏回答，沉淀可复习的知识卡" }}>
      <StudentPage layout="wide">
        <PageHeader
          eyebrow="AGENT NOTEBOOK"
          title="学习笔记"
          description="原回答负责溯源，自动归纳负责复习；你的补充和人工标签始终保留。"
        />

        <form action="/notes" className="grid gap-2 border-y border-foreground/35 bg-card/40 p-3 md:grid-cols-[minmax(12rem,1fr)_auto_auto_auto_auto]">
          <Input name="keyword" defaultValue={query.keyword} placeholder="搜索标题、摘要、原回答或补充" aria-label="搜索学习笔记" />
          <select name="source" defaultValue={query.source ?? ""} className="h-10 border border-input bg-background px-3 text-sm">
            <option value="">全部来源</option>
            <option value="TUTOR">讲题助教</option>
            <option value="KNOWLEDGE">课程知识</option>
          </select>
          <select name="status" defaultValue={query.status ?? ""} className="h-10 border border-input bg-background px-3 text-sm">
            <option value="">全部状态</option>
            <option value="PENDING">等待归纳</option>
            <option value="PROCESSING">正在归纳</option>
            <option value="READY">归纳完成</option>
            <option value="FAILED">归纳失败</option>
          </select>
          <select name="tagId" defaultValue={query.tagId ?? ""} className="h-10 max-w-52 border border-input bg-background px-3 text-sm">
            <option value="">全部知识点</option>
            {leafTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.path || tag.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="submit" className={cn(buttonVariants(), "h-10")}>筛选</button>
            <Link
              href={query.trashed === "true" ? "/notes" : "/notes?trashed=true"}
              className={cn(buttonVariants({ variant: "outline" }), "h-10")}
            >
              {query.trashed === "true" ? "返回笔记" : "回收站"}
            </Link>
          </div>
        </form>

        <NotesWorkspace initialData={notes} leafTags={leafTags} queryString={queryString} />

        {notes.pagination.totalPages > 1 ? (
          <nav className="flex items-center justify-end gap-2" aria-label="学习笔记分页">
            <Link
              aria-disabled={notes.pagination.page <= 1}
              href={`/notes?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(queryString)), page: String(Math.max(1, notes.pagination.page - 1)) })}`}
              className={cn(buttonVariants({ variant: "outline" }), notes.pagination.page <= 1 && "pointer-events-none opacity-50")}
            >
              上一页
            </Link>
            <span className="text-sm text-muted-foreground">{notes.pagination.page} / {notes.pagination.totalPages}</span>
            <Link
              aria-disabled={notes.pagination.page >= notes.pagination.totalPages}
              href={`/notes?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(queryString)), page: String(Math.min(notes.pagination.totalPages, notes.pagination.page + 1)) })}`}
              className={cn(buttonVariants({ variant: "outline" }), notes.pagination.page >= notes.pagination.totalPages && "pointer-events-none opacity-50")}
            >
              下一页
            </Link>
          </nav>
        ) : null}
      </StudentPage>
    </AppShell>
  );
}
