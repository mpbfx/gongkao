import { describe, expect, it } from "vitest";

import { toPaperSessionLists } from "@/server/services/papers";

describe("paper session lists", () => {
  it("separates resumable sessions and keeps the latest submission per purpose", () => {
    const sessions = [
      {
        id: "active",
        status: "IN_PROGRESS",
        purpose: "PRACTICE",
        submittedAt: null,
        updatedAt: new Date("2026-07-22T08:00:00.000Z"),
      },
      {
        id: "latest-baseline",
        status: "SUBMITTED",
        purpose: "BASELINE",
        submittedAt: new Date("2026-07-21T08:00:00.000Z"),
        updatedAt: new Date("2026-07-21T08:00:00.000Z"),
      },
      {
        id: "older-baseline",
        status: "SUBMITTED",
        purpose: "BASELINE",
        submittedAt: new Date("2026-07-20T08:00:00.000Z"),
        updatedAt: new Date("2026-07-20T08:00:00.000Z"),
      },
    ];

    const result = toPaperSessionLists(sessions);

    expect(result.activeSessions.map((session) => session.id)).toEqual(["active"]);
    expect(result.submittedSessions.map((session) => session.id)).toEqual([
      "latest-baseline",
    ]);
  });
});
