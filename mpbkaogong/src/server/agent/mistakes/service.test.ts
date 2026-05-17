import { describe, expect, it } from "vitest";

import { movingAverage } from "@/server/agent/mistakes/service";
import { mistakeCauseSchema, tutorAutoReviewConfigSchema, tutorModelOutputSchema } from "@/server/agent/shared/schemas";

describe("mistake review schemas", () => {
  it("supports the first-version mistake cause taxonomy", () => {
    expect(mistakeCauseSchema.options).toEqual([
      "READING_MISS",
      "CONCEPT_GAP",
      "METHOD_GAP",
      "OPTION_TRAP",
      "CALCULATION_ERROR",
      "MATERIAL_LOCATION_ERROR",
      "LOGIC_CHAIN_BREAK",
      "TIME_STRATEGY_ERROR",
      "CARELESSNESS",
      "UNKNOWN",
    ]);
  });

  it("requires structured tutor review fields", () => {
    const parsed = tutorModelOutputSchema.safeParse({
      mistakeCause: "OPTION_TRAP",
      confidence: "MEDIUM",
      causeSummary: "用户答案被干扰项中的局部表述吸引。",
      fastestPath: "先看题干限定，再排除只满足局部条件的选项。",
      transferRule: "遇到绝对化或局部正确选项，回到题干限定逐项核验。",
      answer: "## 本题错因\n被干扰项吸引。",
      suggestedPrompts: ["这题最快怎么做？"],
    });

    expect(parsed.success).toBe(true);
  });

  it("parses the auto review switch without treating false strings as enabled", () => {
    expect(tutorAutoReviewConfigSchema.parse({ enabled: "false", maxQuestionsPerSession: "8" })).toEqual({
      enabled: false,
      maxQuestionsPerSession: 8,
    });
    expect(tutorAutoReviewConfigSchema.parse({ enabled: "on", maxQuestionsPerSession: "10" }).enabled).toBe(true);
  });
});

describe("mistake insight calculations", () => {
  it("calculates a rolling average for trend smoothing", () => {
    expect(movingAverage([1, 2, 3, 4], 3)).toEqual([1, 1.5, 2, 3]);
  });
});
