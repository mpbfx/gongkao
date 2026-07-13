import { AppShell } from "@/components/layout/app-shell";
import { PageSkeleton } from "@/components/student/page-building-blocks";

export default function SpecialPracticeLoading() {
  return (
    <AppShell>
      <PageSkeleton title="正在加载专项练习" rows={2} />
    </AppShell>
  );
}
