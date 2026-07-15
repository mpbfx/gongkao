import { AppShell } from "@/components/layout/app-shell";
import { PageSkeleton } from "@/components/student/page-building-blocks";

export default function DashboardLoading() {
  return (
    <AppShell header={{ title: "学习情况" }}>
      <PageSkeleton title="正在整理学习情况" rows={6} />
    </AppShell>
  );
}
