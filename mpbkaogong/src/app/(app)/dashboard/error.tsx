"use client";

import { StudentRouteError } from "@/components/student/student-route-error";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <StudentRouteError
      title="学习情况加载失败"
      description="练习记录没有丢失，请稍后重新整理这份学习档案。"
      reset={reset}
    />
  );
}
