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
