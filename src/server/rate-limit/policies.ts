import { z } from "zod";

import type { RateLimitRule } from "@/server/rate-limit/limiter";

/**
 * 各入口的限流额度。
 *
 * 大模型入口按会员状态区分每日额度：上游 API Key 全局共享，没有额度约束时
 * 单个账号即可打满账单并触发 429，进而影响所有用户。
 */

const positiveInt = z.coerce.number().int().positive();

function readLimit(value: string | undefined, fallback: number) {
  const parsed = positiveInt.safeParse(value ?? fallback);
  return parsed.success ? parsed.data : fallback;
}

export function getAgentRateLimitConfig() {
  return {
    perMinute: readLimit(process.env.AGENT_RATE_LIMIT_PER_MINUTE, 5),
    perHour: readLimit(process.env.AGENT_RATE_LIMIT_PER_HOUR, 60),
    dailyFree: readLimit(process.env.AGENT_RATE_LIMIT_DAILY_FREE, 40),
    dailyMember: readLimit(process.env.AGENT_RATE_LIMIT_DAILY_MEMBER, 400),
    autoReviewDaily: readLimit(process.env.AGENT_RATE_LIMIT_AUTO_REVIEW_DAILY, 60),
  };
}

/** 讲题助教、知识问答、笔记重生成共用同一份大模型额度。 */
export function agentChatRules(hasMembership: boolean): RateLimitRule[] {
  const config = getAgentRateLimitConfig();

  return [
    { name: "burst", limit: config.perMinute, windowSeconds: 60 },
    { name: "hourly", limit: config.perHour, windowSeconds: 3_600 },
    {
      name: "daily",
      limit: hasMembership ? config.dailyMember : config.dailyFree,
      windowSeconds: 86_400,
    },
  ];
}

/**
 * 提交练习后自动触发的错题复盘。
 *
 * 它跑在 after() 里、客户端无需等待，是最容易被脚本放大的入口，
 * 因此按「每道题一次」单独计量每日上限。
 */
export function agentAutoReviewRules(): RateLimitRule[] {
  return [{ name: "daily", limit: getAgentRateLimitConfig().autoReviewDaily, windowSeconds: 86_400 }];
}

/** 登录失败限流，防止在线暴力破解。 */
export function loginAttemptRules(): RateLimitRule[] {
  return [
    { name: "burst", limit: readLimit(process.env.LOGIN_RATE_LIMIT_PER_MINUTE, 5), windowSeconds: 60 },
    { name: "hourly", limit: readLimit(process.env.LOGIN_RATE_LIMIT_PER_HOUR, 20), windowSeconds: 3_600 },
  ];
}
