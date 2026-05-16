"use client";

import { RotateCcw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function PapersError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-4 py-6 md:px-6 md:py-8">
      <Alert variant="destructive">
        <AlertTitle>试卷加载失败</AlertTitle>
        <AlertDescription>请稍后重试。</AlertDescription>
      </Alert>
      <Button type="button" variant="outline" className="w-fit" onClick={reset}>
        <RotateCcw data-icon="inline-start" />
        重试
      </Button>
    </main>
  );
}
