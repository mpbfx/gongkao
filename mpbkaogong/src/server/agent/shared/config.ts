import { tutorAutoReviewConfigSchema } from "@/server/agent/shared/schemas";

export const defaultTutorAutoReviewConfig = {
  enabled: true,
  maxQuestionsPerSession: 10,
};

export function getTutorAutoReviewConfig() {
  return tutorAutoReviewConfigSchema.parse({
    enabled: process.env.TUTOR_AUTO_REVIEW_ENABLED ?? defaultTutorAutoReviewConfig.enabled,
    maxQuestionsPerSession:
      process.env.TUTOR_AUTO_REVIEW_MAX_QUESTIONS ?? defaultTutorAutoReviewConfig.maxQuestionsPerSession,
  });
}
