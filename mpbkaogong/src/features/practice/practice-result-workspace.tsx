"use client";

import { useState } from "react";

import { PracticeResultOverview } from "@/features/practice/practice-result-panels";
import { cn } from "@/lib/utils";

type WorkspaceTab = "review" | "sheet";

type ResultSummary = {
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  accuracy: string | null;
  elapsedSeconds: number;
};

export function PracticeResultWorkspace({
  summary,
  reviewMode,
  currentIndex,
  totalCount,
  questionPane,
  analysisPane,
  answerSheet,
  tutorPane,
}: {
  summary: ResultSummary;
  reviewMode: boolean;
  currentIndex: number;
  totalCount: number;
  questionPane: React.ReactNode;
  analysisPane: React.ReactNode;
  answerSheet: React.ReactNode;
  tutorPane: React.ReactNode;
}) {
  const [tab, setTab] = useState<WorkspaceTab>("review");

  return (
    <main className="practice-result-workbench flex min-h-0 flex-1 flex-col bg-[#eeece6] lg:h-[calc(100dvh-4.25rem)] lg:overflow-hidden">
      <PracticeResultOverview
        summary={summary}
        reviewMode={reviewMode}
        currentIndex={currentIndex}
        totalCount={totalCount}
      />

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col border-r border-foreground/20 bg-[#faf8f2]">
          <div className="flex h-12 shrink-0 items-end border-b border-foreground/20 px-3">
            {[
              { key: "review" as const, label: "题目卷面" },
              { key: "sheet" as const, label: `答题卡 ${currentIndex + 1}/${totalCount}` },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={cn(
                  "relative h-12 px-5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none",
                  tab === item.key && "font-semibold text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary"
                )}
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {tab === "review" ? (
              <div className="grid h-full min-h-0 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
                <div className="min-h-0 overflow-y-auto border-r border-foreground/20">{questionPane}</div>
                <div className="relative min-h-0 overflow-y-auto">{analysisPane}<span className="practice-pane-handle" aria-hidden="true" /></div>
              </div>
            ) : null}
            {tab === "sheet" ? <div className="h-full overflow-y-auto p-5 lg:px-[8%]">{answerSheet}</div> : null}
          </div>
        </section>

        <aside className="practice-tutor-workbench flex min-h-[32rem] w-full flex-col border-t border-foreground/20 bg-[#fbf9f4] lg:min-h-0 lg:w-[36%] lg:min-w-[25rem] lg:max-w-[38rem] lg:border-t-0">
          {tutorPane}
        </aside>
      </div>
    </main>
  );
}
