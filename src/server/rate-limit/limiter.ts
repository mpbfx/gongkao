import IORedis from "ioredis";

import { ServiceUnavailableError } from "@/server/services/errors";

/**
 * 基于 Redis 有序集合的滑动窗口限流。
 *
 * 用于给成本敏感或可被滥用的入口（大模型调用、登录）加统一防线。
 * 计数与判定在同一段 Lua 里完成，保证并发下不会超发。
 */

export type RateLimitRule = {
  /** 超限提示与日志用的可读名称 */
  name: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  rule: RateLimitRule;
};

const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)

local used = redis.call('ZCARD', key)
if used >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryMs = windowMs
  if oldest[2] then
    retryMs = windowMs - (now - tonumber(oldest[2]))
  end
  if retryMs < 1 then retryMs = 1 end
  return {0, 0, retryMs}
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, windowMs)
return {1, limit - used - 1, 0}
`;

type LimiterGlobals = typeof globalThis & {
  rateLimitConnection?: IORedis | null;
  rateLimitDisabledWarned?: boolean;
};

function connection() {
  const globals = globalThis as LimiterGlobals;

  if (globals.rateLimitConnection !== undefined) {
    return globals.rateLimitConnection;
  }

  const url = process.env.REDIS_URL?.trim();

  if (!url) {
    // 本地开发允许不启 Redis；生产环境务必配置，否则失去唯一的成本防线。
    if (!globals.rateLimitDisabledWarned) {
      globals.rateLimitDisabledWarned = true;
      console.warn("REDIS_URL 未配置，限流已禁用；生产环境必须配置 REDIS_URL");
    }

    globals.rateLimitConnection = null;
    return null;
  }

  const client = new IORedis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: 2_000,
  });

  client.on("error", (error) => {
    console.error("限流 Redis 连接异常", error);
  });

  client.defineCommand("consumeSlidingWindow", {
    numberOfKeys: 1,
    lua: SLIDING_WINDOW_SCRIPT,
  });

  globals.rateLimitConnection = client;
  return client;
}

type ConsumingRedis = IORedis & {
  consumeSlidingWindow(
    key: string,
    now: string,
    windowMs: string,
    limit: string,
    member: string
  ): Promise<[number, number, number]>;
};

/**
 * 消耗一次配额。
 *
 * Redis 不可用时**拒绝放行**：限流是这些入口唯一的成本防线，失效时放开等于
 * 回到问题本身。未配置 REDIS_URL 的本地开发环境则直接放行。
 */
export async function consumeRateLimit(
  key: string,
  rule: RateLimitRule
): Promise<RateLimitDecision> {
  const client = connection();

  if (!client) {
    return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0, rule };
  }

  const windowMs = rule.windowSeconds * 1_000;
  const now = Date.now();

  try {
    const [allowed, remaining, retryMs] = await (client as ConsumingRedis).consumeSlidingWindow(
      `ratelimit:${key}`,
      String(now),
      String(windowMs),
      String(rule.limit),
      `${now}-${Math.random().toString(36).slice(2, 10)}`
    );

    return {
      allowed: allowed === 1,
      remaining,
      retryAfterSeconds: Math.ceil(retryMs / 1_000),
      rule,
    };
  } catch (error) {
    console.error("限流判定失败，按拒绝处理", { key, rule: rule.name, error });
    throw new ServiceUnavailableError("限流服务暂时不可用，请稍后再试");
  }
}

export class RateLimitedError extends Error {
  constructor(
    message: string,
    public retryAfterSeconds: number
  ) {
    super(message);
    this.name = "RateLimitedError";
  }
}

function formatWindow(windowSeconds: number) {
  if (windowSeconds >= 86_400) {
    return `${Math.round(windowSeconds / 86_400)} 天`;
  }

  if (windowSeconds >= 3_600) {
    return `${Math.round(windowSeconds / 3_600)} 小时`;
  }

  if (windowSeconds >= 60) {
    return `${Math.round(windowSeconds / 60)} 分钟`;
  }

  return `${windowSeconds} 秒`;
}

/**
 * 依次校验多条规则，任意一条超限即抛出 RateLimitedError。
 *
 * 规则应按窗口从短到长传入，让突发流量先命中短窗口规则，得到更短的重试提示。
 */
export async function enforceRateLimit(scope: string, subject: string, rules: RateLimitRule[]) {
  for (const rule of rules) {
    const decision = await consumeRateLimit(`${scope}:${rule.name}:${subject}`, rule);

    if (!decision.allowed) {
      throw new RateLimitedError(
        `操作过于频繁，每${formatWindow(rule.windowSeconds)}最多 ${rule.limit} 次，请 ${decision.retryAfterSeconds} 秒后再试`,
        decision.retryAfterSeconds
      );
    }
  }
}

/**
 * 清空某个主体已消耗的额度。
 *
 * 登录用它实现「连续失败 N 次」而不是「N 次尝试」的语义：验证通过即清零，
 * 正常用户不会因为偶尔输错而被锁。
 */
export async function resetRateLimit(scope: string, subject: string, rules: RateLimitRule[]) {
  const client = connection();

  if (!client) {
    return;
  }

  try {
    await client.del(...rules.map((rule) => `ratelimit:${scope}:${rule.name}:${subject}`));
  } catch (error) {
    console.error("重置限流计数失败", { scope, subject, error });
  }
}
