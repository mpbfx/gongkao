"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function StudentRouteError({
  title,
  description,
  reset,
}: {
  title: string;
  description: string;
  reset: () => void;
}) {
  return (
    <main className="student-auth flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-xs">
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{description}</AlertDescription>
        </Alert>
        <Button type="button" variant="outline" className="mt-4" onClick={reset}>
          <RotateCcw data-icon="inline-start" />
          重新加载
        </Button>
      </section>
    </main>
  );
}
