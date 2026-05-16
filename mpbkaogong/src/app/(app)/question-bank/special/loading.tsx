import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SpecialPracticeLoading() {
  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
        <Card>
          <CardHeader>
            <CardTitle>正在加载专项练习</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32 rounded-lg bg-muted" />
          </CardContent>
        </Card>
      </main>
    </AppShell>
  );
}
