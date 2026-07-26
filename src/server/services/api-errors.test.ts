import { describe, expect, it, vi } from "vitest";

// guards 会拉起 next-auth，在 Node 测试环境下无法解析，这里只需要它的错误类型。
vi.mock("@/lib/auth/guards", () => ({
  UnauthorizedError: class extends Error {},
  ForbiddenError: class extends Error {},
}));

import { RateLimitedError } from "@/server/rate-limit/limiter";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import { MembershipRequiredError } from "@/server/services/errors";

describe("apiErrorFromUnknown", () => {
  it("把限流错误映射成 429 并带上 Retry-After", async () => {
    const response = apiErrorFromUnknown(new RateLimitedError("操作过于频繁", 42));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED", message: "操作过于频繁" },
    });
  });

  it("会员门槛错误仍映射成 403", async () => {
    const response = apiErrorFromUnknown(new MembershipRequiredError());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MEMBERSHIP_REQUIRED" },
    });
  });
});
