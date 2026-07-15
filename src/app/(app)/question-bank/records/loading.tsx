import { AppShell } from "@/components/layout/app-shell";
import { PageSkeleton } from "@/components/student/page-building-blocks";

export default function RecordsLoading() {
  return (
    <AppShell>
      <PageSkeleton title="正在加载练习记录" rows={5} />
    </AppShell>
  );
}
