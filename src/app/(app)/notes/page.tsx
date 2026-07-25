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
    trashed: first(raw.trashed),
    page: first(raw.page),
    pageSize: first(raw.pageSize),
  };
  const notes = await listAgentNotes(user, query);
  const trashed = query.trashed === "true";
  const queryString = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) => (value ? [[key, value]] : []))
  ).toString();

  return (
    <AppShell header={{ title: "学习笔记", subtitle: "收藏回答，沉淀可复习的知识卡" }}>
      <StudentPage className="max-w-[58rem]">
        <PageHeader
          title={trashed ? "最近删除" : "学习笔记"}
          description={
            trashed
              ? "删除的笔记可以在这里恢复。"
              : "收藏值得复习的回答，剩下的交给系统整理。"
          }
          secondaryActions={
            <Link
              href={trashed ? "/notes" : "/notes?trashed=true"}
              className="min-h-11 py-3 text-sm text-muted-foreground underline decoration-foreground/25 underline-offset-4 hover:text-foreground"
            >
              {trashed ? "返回学习笔记" : "最近删除"}
            </Link>
          }
        />

        <form action="/notes" className="flex gap-2">
          {trashed ? <input type="hidden" name="trashed" value="true" /> : null}
          <Input
            name="keyword"
            defaultValue={query.keyword}
            placeholder="搜索我的笔记"
            aria-label="搜索学习笔记"
            className="min-h-11 flex-1 bg-card"
          />
          <button type="submit" className={cn(buttonVariants(), "min-h-11 px-5")}>
            搜索
          </button>
        </form>

        <NotesWorkspace
          key={queryString || "all-notes"}
          initialData={notes}
          queryString={queryString}
          trashed={trashed}
        />

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
