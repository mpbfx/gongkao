import { Grid3X3 } from "lucide-react";

import {
  questionStatusLabel,
  stripPracticeHtml,
  type QuestionStatus,
} from "@/features/practice/practice-view-utils";
import { cn } from "@/lib/utils";

type AnswerSheetQuestion = {
  id: string;
  titleHtml: string;
};

type AnswerSheetGroup<TQuestion extends AnswerSheetQuestion> = {
  name: string;
  items: Array<{
    question: TQuestion;
    index: number;
  }>;
};

export function PracticeAnswerSheet<TQuestion extends AnswerSheetQuestion>({
  groups,
  currentIndex,
  answeredCount,
  totalCount,
  completionRate,
  isMemorizeMode,
  legend,
  getButtonClassName,
  getQuestionStatus,
  onSelect,
}: {
  groups: AnswerSheetGroup<TQuestion>[];
  currentIndex: number;
  answeredCount: number;
  totalCount: number;
  completionRate: number;
  isMemorizeMode: boolean;
  legend: Array<{ label: string; className: string }>;
  getButtonClassName: (question: TQuestion, index: number) => string;
  getQuestionStatus: (question: TQuestion) => QuestionStatus;
  onSelect: (index: number) => void;
}) {
  const completionPercent = Math.round(completionRate * 100);

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="student-heading flex items-center gap-2 font-medium">
            <Grid3X3 className="size-4" aria-hidden="true" />
            答题卡
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isMemorizeMode ? `共 ${totalCount} 题` : `已答 ${answeredCount} / ${totalCount}`}
          </p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">完成 {completionPercent}%</span>
      </div>
      <div className="h-1.5 shrink-0 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${completionPercent}%` }} />
      </div>
      <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-2 text-xs text-muted-foreground">
        {legend.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm border", item.className)} />
            {item.label}
          </span>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {groups.map((group) => {
          const currentGroup = group.items.some((item) => item.index === currentIndex);

          return (
            <details key={group.name} open={currentGroup || groups.length <= 3} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-1 py-1 text-sm font-medium hover:bg-muted">
                <span className="truncate">{group.name}</span>
                <span className="text-xs text-muted-foreground">{group.items.length} 题</span>
              </summary>
              <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-2">
                {group.items.map(({ question, index }) => (
                  <button
                    key={`${group.name}-${question.id}-${index}`}
                    type="button"
                    className={getButtonClassName(question, index)}
                    title={stripPracticeHtml(question.titleHtml)}
                    aria-label={`第 ${index + 1} 题，${questionStatusLabel(getQuestionStatus(question))}`}
                    aria-current={index === currentIndex ? "true" : undefined}
                    onClick={() => onSelect(index)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
