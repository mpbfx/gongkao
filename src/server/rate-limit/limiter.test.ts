import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  /** 记录每个 key 的时间戳，模拟滑动窗口的 Lua 行为 */
  windows: new Map<string, number[]>(),
  deleted: [] as string[],
  shouldThrow: false,
}));

vi.mock("ioredis", () => ({
  default: class {
    on() {}
    defineCommand() {}

    async consumeSlidingWindow(key: string, now: string, windowMs: string, limit: string) {
      if (mocks.shouldThrow) {
        throw new Error("redis down");
      }

      const at = Number(now);
      const window = Number(windowMs);
      const max = Number(limit);
      const kept = (mocks.windows.get(key) ?? []).filter((score) => score > at - window);

      if (kept.length >= max) {
        mocks.windows.set(key, kept);
        return [0, 0, window - (at - kept[0])];
      }

      kept.push(at);
      mocks.windows.set(key, kept);
      return [1, max - kept.length, 0];
    }

    async del(...keys: string[]) {
      mocks.deleted.push(...keys);
      keys.forEach((key) => mocks.windows.delete(key));
      return keys.length;
    }
  },
}));

import {
  consumeRateLimit,
  enforceRateLimit,
  RateLimitedError,
  resetRateLimit,
} from "@/server/rate-limit/limiter";
import { ServiceUnavailableError } from "@/server/services/errors";

function clearLimiterGlobals() {
  const globals = globalThis as typeof globalThis & {
    rateLimitConnection?: unknown;
    rateLimitDisabledWarned?: boolean;
  };
  delete globals.rateLimitConnection;
  delete globals.rateLimitDisabledWarned;
}

const rule = { name: "burst", limit: 3, windowSeconds: 60 };

describe("consumeRateLimit", () => {
  beforeEach(() => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    clearLimiterGlobals();
    mocks.windows.clear();
    mocks.deleted.length = 0;
    mocks.shouldThrow = false;
  });

  it("在额度内放行并递减剩余次数", async () => {
    expect(await consumeRateLimit("k", rule)).toMatchObject({ allowed: true, remaining: 2 });
    expect(await consumeRateLimit("k", rule)).toMatchObject({ allowed: true, remaining: 1 });
    expect(await consumeRateLimit("k", rule)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("超出额度后拒绝并给出重试秒数", async () => {
    await consumeRateLimit("k", rule);
    await consumeRateLimit("k", rule);
    await consumeRateLimit("k", rule);

    const decision = await consumeRateLimit("k", rule);

    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("不同主体的额度互相独立", async () => {
    await consumeRateLimit("a", rule);
    await consumeRateLimit("a", rule);
    await consumeRateLimit("a", rule);

    expect(await consumeRateLimit("b", rule)).toMatchObject({ allowed: true });
  });

  it("未配置 REDIS_URL 时直接放行", async () => {
    delete process.env.REDIS_URL;
    clearLimiterGlobals();

    expect(await consumeRateLimit("k", rule)).toMatchObject({ allowed: true });
  });

  it("Redis 异常时拒绝放行而不是静默放开", async () => {
    mocks.shouldThrow = true;

    await expect(consumeRateLimit("k", rule)).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe("enforceRateLimit", () => {
  beforeEach(() => {
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    clearLimiterGlobals();
    mocks.windows.clear();
    mocks.deleted.length = 0;
    mocks.shouldThrow = false;
  });

  it("任意一条规则超限即抛出 RateLimitedError", async () => {
    const rules = [
      { name: "burst", limit: 2, windowSeconds: 60 },
      { name: "daily", limit: 100, windowSeconds: 86_400 },
    ];

    await enforceRateLimit("agent-chat", "user-1", rules);
    await enforceRateLimit("agent-chat", "user-1", rules);

    await expect(enforceRateLimit("agent-chat", "user-1", rules)).rejects.toBeInstanceOf(
      RateLimitedError
    );
  });

  it("不同 scope 之间不共享额度", async () => {
    const rules = [{ name: "burst", limit: 1, windowSeconds: 60 }];

    await enforceRateLimit("agent-chat", "user-1", rules);

    await expect(enforceRateLimit("login", "user-1", rules)).resolves.toBeUndefined();
  });

  it("resetRateLimit 清零后可以重新放行", async () => {
    const rules = [{ name: "burst", limit: 1, windowSeconds: 60 }];

    await enforceRateLimit("login", "email:a@b.com", rules);
    await expect(enforceRateLimit("login", "email:a@b.com", rules)).rejects.toBeInstanceOf(
      RateLimitedError
    );

    await resetRateLimit("login", "email:a@b.com", rules);

    await expect(enforceRateLimit("login", "email:a@b.com", rules)).resolves.toBeUndefined();
  });
});
