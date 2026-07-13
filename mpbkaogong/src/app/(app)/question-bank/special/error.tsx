"use client";

import { StudentRouteError } from "@/components/student/student-route-error";

export default function SpecialPracticeError({ reset }: { reset: () => void }) {
  return (
    <StudentRouteError title="专项分类加载失败" description="暂时无法读取知识点分类，请稍后重新加载。" reset={reset} />
  );
}
