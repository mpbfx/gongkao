import { describe, expect, it } from "vitest";

import {
  formatPracticeClock,
  getInitialPracticeQuestionIndex,
  normalizePracticeAnswer,
  optionStateLabel,
  practiceOptionButtonClassName,
  questionStatusLabel,
} from "./practice-view-utils";

describe("practice view utilities", () => {
  it("normalizes multiple answers deterministically", () => {
    expect(normalizePracticeAnswer("C, A, C")).toBe("A,C");
    expect(normalizePracticeAnswer(null)).toBe("");
  });

  it("formats timers and state labels", () => {
    expect(formatPracticeClock(125)).toBe("02:05");
    expect(questionStatusLabel("wrong")).toBe("错误");
    expect(optionStateLabel("correct")).toBe("正确答案");
    expect(optionStateLabel("default")).toBeNull();
  });

  it("opens a resumed session at its first unanswered question", () => {
    expect(
      getInitialPracticeQuestionIndex("IN_PROGRESS", [
        { answer: "A" },
        { answer: " C " },
        { answer: null },
        { answer: "B" },
      ])
    ).toBe(2);
    expect(getInitialPracticeQuestionIndex("SUBMITTED", [{ answer: null }])).toBe(0);
  });

  it("renders practice options as paper list rows instead of soft cards", () => {
    const idle = practiceOptionButtonClassName("default");
    expect(idle).toContain("practice-option-row");
    expect(idle).toContain("bg-transparent");
    expect(idle).toContain("border-b");
    expect(idle).not.toContain("rounded-lg");
    expect(idle).not.toContain("bg-card");

    const selected = practiceOptionButtonClassName("selected");
    expect(selected).toContain("shadow-[inset_3px_0_0_var(--primary)]");
    expect(selected).toContain("bg-primary/8");

    const pausedResult = practiceOptionButtonClassName("wrong", {
      isResultMode: true,
      isPracticePaused: true,
    });
    expect(pausedResult).toContain("disabled:opacity-100");
    expect(pausedResult).toContain("opacity-40");
    expect(pausedResult).toContain("shadow-[inset_3px_0_0_var(--destructive)]");
  });
});
