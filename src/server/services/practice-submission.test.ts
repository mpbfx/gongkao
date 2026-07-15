import { describe, expect, it } from "vitest";

import { validateSubmittedQuestionIds } from "@/server/services/practice-submission";

describe("practice submission validation", () => {
  it("accepts missing answers as unanswered questions", () => {
    expect(() =>
      validateSubmittedQuestionIds({
        sessionQuestionIds: ["q1", "q2"],
        submittedQuestionIds: ["q1"],
      })
    ).not.toThrow();
  });

  it("rejects duplicate questions", () => {
    expect(() =>
      validateSubmittedQuestionIds({
        sessionQuestionIds: ["q1", "q2"],
        submittedQuestionIds: ["q1", "q1"],
      })
    ).toThrow("提交答案包含重复题目");
  });

  it("rejects questions outside the session", () => {
    expect(() =>
      validateSubmittedQuestionIds({
        sessionQuestionIds: ["q1"],
        submittedQuestionIds: ["q2"],
      })
    ).toThrow("提交答案包含本练习之外的题目");
  });
});
