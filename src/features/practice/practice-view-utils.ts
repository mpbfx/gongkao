export type QuestionStatus = "answered" | "correct" | "wrong" | "default";
export type OptionState = "selected" | "correct" | "wrong" | "default";

export function normalizePracticeAnswer(answer?: string | null) {
  if (!answer) {
    return "";
  }

  return Array.from(
    new Set(
      answer
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    )
  )
    .sort()
    .join(",");
}

export function getInitialPracticeQuestionIndex(
  status: string,
  answers: Array<{ answer?: string | null }>
) {
  if (status !== "IN_PROGRESS") return 0;
  const firstUnansweredIndex = answers.findIndex(
    (answer) => !normalizePracticeAnswer(answer.answer)
  );
  return firstUnansweredIndex >= 0 ? firstUnansweredIndex : 0;
}

export function formatPracticeClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function stripPracticeHtml(html?: string | null) {
  return html?.replace(/<[^>]*>/g, "") ?? "";
}

export function questionStatusLabel(status: QuestionStatus) {
  return status === "correct"
    ? "正确"
    : status === "wrong"
      ? "错误"
      : status === "answered"
        ? "已答"
        : "未答";
}

export function optionStateLabel(state: OptionState) {
  return state === "correct"
    ? "正确答案"
    : state === "wrong"
      ? "我的误选"
      : state === "selected"
        ? "已选择"
        : null;
}

/** Editorial paper-list classes for practice option rows (no soft SaaS cards). */
export function practiceOptionButtonClassName(
  state: OptionState,
  flags: { isResultMode?: boolean; isPracticePaused?: boolean } = {}
) {
  const classes = [
    "practice-option-row",
    "flex min-h-12 w-full items-start gap-3 border-0 border-b border-foreground/20 bg-transparent px-2 py-3.5 text-left text-sm transition-colors",
    "first:border-t",
    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
    "disabled:cursor-not-allowed",
  ];

  if (state === "selected") {
    classes.push("bg-primary/8 text-foreground shadow-[inset_3px_0_0_var(--primary)]");
  }

  if (state === "correct") {
    classes.push("bg-success/8 text-success shadow-[inset_3px_0_0_var(--success)]");
  }

  if (state === "wrong") {
    classes.push("bg-destructive/8 text-destructive shadow-[inset_3px_0_0_var(--destructive)]");
  }

  if (flags.isResultMode) {
    classes.push("disabled:opacity-100");
  }

  if (flags.isPracticePaused) {
    classes.push("opacity-40");
  }

  return classes.join(" ");
}
