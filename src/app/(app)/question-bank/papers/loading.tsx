import { AppShell } from "@/components/layout/app-shell";
import { PageSkeleton } from "@/components/student/page-building-blocks";

export default function PapersLoading() {
  return (
    <AppShell>
      <PageSkeleton title="正在加载试卷" rows={4} />
    </AppShell>
  );
}
