import { describe, expect, it } from "vitest";

import {
  formatPracticeClock,
  getInitialPracticeQuestionIndex,
  normalizePracticeAnswer,
  optionStateLabel,
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
});
