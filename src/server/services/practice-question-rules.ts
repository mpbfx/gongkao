import type { Prisma } from "@/generated/prisma/client";

export function buildPracticeQuestionWhere({
  hasMembership,
  difficulty,
}: {
  hasMembership: boolean;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | "UNKNOWN" | null;
}) {
  return {
    isActive: true,
    deletedAt: null,
    ...(hasMembership ? {} : { isVipOnly: false }),
    ...(difficulty ? { difficulty } : {}),
  } satisfies Prisma.QuestionWhereInput;
}
