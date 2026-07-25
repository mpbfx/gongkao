import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { StudentPage } from "@/components/student/page-building-blocks";
import { NoteDetailView } from "@/features/notes/note-detail-view";
import { requireUser } from "@/lib/auth/guards";
import { getAgentNote } from "@/server/agent/notes/service";
import { NotFoundError } from "@/server/services/errors";
import { listActiveTagsFlat } from "@/server/services/tags";

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  const user = await requireUser().catch(() => null);
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(`/notes/${noteId}`)}`);

  let note;
  try {
    note = await getAgentNote(user, noteId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const tags = await listActiveTagsFlat();
  const leafTags = tags
    .filter((tag) => tag.isLeaf)
    .map((tag) => ({ id: tag.id, name: tag.name, path: tag.path }));

  return (
    <AppShell
      hideMobileNav
      header={{ title: "学习笔记", subtitle: note.title }}
    >
      <StudentPage className="max-w-[58rem]">
        <Link
          href={note.trashedAt ? "/notes?trashed=true" : "/notes"}
          className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {note.trashedAt ? "返回最近删除" : "返回学习笔记"}
        </Link>
        <NoteDetailView initialNote={note} leafTags={leafTags} />
      </StudentPage>
    </AppShell>
  );
}
