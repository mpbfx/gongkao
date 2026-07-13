"use client";

import { StudentRouteError } from "@/components/student/student-route-error";

export default function PapersError({ reset }: { reset: () => void }) {
  return (
    <StudentRouteError title="试卷加载失败" description="暂时无法读取试卷，请稍后重新加载。" reset={reset} />
  );
}
