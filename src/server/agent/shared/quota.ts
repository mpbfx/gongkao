import type { AuthenticatedUser } from "@/lib/auth/guards";
import { enforceRateLimit } from "@/server/rate-limit/limiter";
import { agentAutoReviewRules, agentChatRules } from "@/server/rate-limit/policies";
import { hasActiveMembership } from "@/server/services/membership";

/**
 * 大模型入口的统一额度校验。
 *
 * 讲题助教、知识问答与笔记重生成共用一份额度：它们打的是同一个上游 API Key，
 * 分开计量无法约束总成本。会员享受更高的每日额度。
 */
export async function assertAgentChatQuota(user: AuthenticatedUser) {
  const isMember = await hasActiveMembership(user.id, user.role);

  await enforceRateLimit("agent-chat", user.id, agentChatRules(isMember));
}

/**
 * 自动错题复盘的每日额度。返回是否放行，不抛异常：
 * 它跑在 after() 里，超额时应静默跳过而不是让请求失败。
 */
export async function tryConsumeAutoReviewQuota(userId: string) {
  try {
    await enforceRateLimit("agent-auto-review", userId, agentAutoReviewRules());
    return true;
  } catch {
    return false;
  }
}
