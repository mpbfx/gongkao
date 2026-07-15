import { describe, expect, it } from "vitest";

import {
  getPracticeDeadline,
  normalizeSubmittedTiming,
} from "@/server/services/practice-timing";

describe("practice timing", () => {
  it("keeps a strict deadline stable across reloads", () => {
    const createdAt = new Date("2026-07-15T00:00:00.000Z");
    expect(
      getPracticeDeadline({ createdAt, timingMode: "STRICT", timeLimitSeconds: 600 })
    ).toEqual(new Date("2026-07-15T00:10:00.000Z"));
  });

  it("uses server elapsed time and removes pause data for strict sessions", () => {
    expect(
      normalizeSubmittedTiming({
        createdAt: new Date("2026-07-15T00:00:00.000Z"),
        timingMode: "STRICT",
        timeLimitSeconds: 600,
        elapsedSeconds: 10,
        pauseCount: 3,
        pausedSeconds: 90,
        now: new Date("2026-07-15T00:05:00.000Z"),
      })
    ).toEqual({ elapsedSeconds: 300, pauseCount: 0, pausedSeconds: 0 });
  });

  it("clamps expired strict sessions to their configured limit", () => {
    expect(
      normalizeSubmittedTiming({
        createdAt: new Date("2026-07-15T00:00:00.000Z"),
        timingMode: "STRICT",
        timeLimitSeconds: 600,
        elapsedSeconds: 20,
        pauseCount: 0,
        pausedSeconds: 0,
        now: new Date("2026-07-15T00:20:00.000Z"),
      }).elapsedSeconds
    ).toBe(600);
  });
});
