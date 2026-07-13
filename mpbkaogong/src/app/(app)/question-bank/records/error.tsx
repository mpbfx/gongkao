"use client";

import { StudentRouteError } from "@/components/student/student-route-error";

export default function RecordsError({ reset }: { reset: () => void }) {
  return (
    <StudentRouteError title="练习记录加载失败" description="你的记录没有丢失，请稍后重新加载。" reset={reset} />
  );
}
