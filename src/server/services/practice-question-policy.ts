import type { AuthenticatedUser } from "@/lib/auth/guards";
import { BusinessError, MembershipRequiredError } from "@/server/services/errors";
import { hasActiveMembership } from "@/server/services/membership";
import { buildPracticeQuestionWhere } from "@/server/services/practice-question-rules";

export async function getPracticeQuestionWhere(
  user: AuthenticatedUser,
  difficulty?: "EASY" | "MEDIUM" | "HARD" | "UNKNOWN" | null
) {
  return buildPracticeQuestionWhere({
    hasMembership: await hasActiveMembership(user.id, user.role),
    difficulty,
  });
}

export async function assertPracticeQuestionsAccessible(
  user: AuthenticatedUser,
  questions: Array<{
    isActive: boolean;
    deletedAt: Date | null;
    isVipOnly: boolean;
  }>
) {
  if (questions.some((question) => !question.isActive || question.deletedAt)) {
    throw new BusinessError("练习中包含已下架题目，请重新选择");
  }

  if (
    questions.some((question) => question.isVipOnly) &&
    !(await hasActiveMembership(user.id, user.role))
  ) {
    throw new MembershipRequiredError("该练习包含会员题目");
  }
}
