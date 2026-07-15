import { describe, expect, it } from "vitest";

import { buildPracticeQuestionWhere } from "@/server/services/practice-question-rules";

describe("practice question policy", () => {
  it("filters inactive, deleted, vip and difficulty for ordinary users", () => {
    expect(
      buildPracticeQuestionWhere({ hasMembership: false, difficulty: "HARD" })
    ).toEqual({
      isActive: true,
      deletedAt: null,
      isVipOnly: false,
      difficulty: "HARD",
    });
  });

  it("keeps vip questions available to members", () => {
    expect(buildPracticeQuestionWhere({ hasMembership: true })).toEqual({
      isActive: true,
      deletedAt: null,
    });
  });
});
