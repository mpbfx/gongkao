import type { Prisma } from "@/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import {
  coachConfigSchema,
  tutorAutoReviewConfigSchema,
  type CoachConfig,
  type TutorAutoReviewConfig,
} from "@/server/agent/shared/schemas";

export const COACH_CONFIG_KEY = "coach.diagnosisWindow";
export const TUTOR_AUTO_REVIEW_CONFIG_KEY = "tutor.autoMistakeReview";

export const defaultCoachConfig: CoachConfig = {
  recentSessionLimit: 20,
  recentDays: 7,
  minAnswersPerTag: 5,
  maxRecommendations: 3,
  slowTimeMultiplier: 1.3,
};

export const defaultTutorAutoReviewConfig: TutorAutoReviewConfig = {
  enabled: true,
  maxQuestionsPerSession: 10,
};

export async function getCoachConfig() {
  const row = await prisma.agentConfig.findUnique({
    where: { key: COACH_CONFIG_KEY },
  });
  const parsed = coachConfigSchema.safeParse(row?.valueJson);

  return parsed.success ? parsed.data : defaultCoachConfig;
}

export async function getTutorAutoReviewConfig() {
  const row = await prisma.agentConfig.findUnique({
    where: { key: TUTOR_AUTO_REVIEW_CONFIG_KEY },
  });
  const parsed = tutorAutoReviewConfigSchema.safeParse(row?.valueJson);

  return parsed.success ? parsed.data : defaultTutorAutoReviewConfig;
}

export async function upsertCoachConfig(user: AuthenticatedUser, input: unknown) {
  const value = coachConfigSchema.parse(input);

  await prisma.agentConfig.upsert({
    where: { key: COACH_CONFIG_KEY },
    update: {
      valueJson: value as Prisma.InputJsonValue,
      updatedByUserId: user.id,
    },
    create: {
      key: COACH_CONFIG_KEY,
      valueJson: value as Prisma.InputJsonValue,
      description: "学习教练诊断窗口和推荐阈值",
      updatedByUserId: user.id,
    },
  });

  return value;
}

export async function upsertTutorAutoReviewConfig(user: AuthenticatedUser, input: unknown) {
  const value = tutorAutoReviewConfigSchema.parse(input);

  await prisma.agentConfig.upsert({
    where: { key: TUTOR_AUTO_REVIEW_CONFIG_KEY },
    update: {
      valueJson: value as Prisma.InputJsonValue,
      updatedByUserId: user.id,
    },
    create: {
      key: TUTOR_AUTO_REVIEW_CONFIG_KEY,
      valueJson: value as Prisma.InputJsonValue,
      description: "讲题助教提交后自动错因分析",
      updatedByUserId: user.id,
    },
  });

  return value;
}
