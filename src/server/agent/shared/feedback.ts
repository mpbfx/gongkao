import type { AuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { agentFeedbackSchema, type AgentFeedbackInput } from "@/server/agent/shared/schemas";
import { NotFoundError } from "@/server/services/errors";

export async function createAgentFeedback(user: AuthenticatedUser, input: AgentFeedbackInput) {
  const data = agentFeedbackSchema.parse(input);

  if (data.targetType === "RECOMMENDATION") {
    const recommendation = await prisma.agentRecommendation.findFirst({
      where: {
        id: data.targetId,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!recommendation) {
      throw new NotFoundError("推荐不存在");
    }
  } else {
    const message = await prisma.agentTutorMessage.findFirst({
      where: {
        id: data.targetId,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!message) {
      throw new NotFoundError("讲题消息不存在");
    }
  }

  return prisma.agentFeedback.create({
    data: {
      userId: user.id,
      targetType: data.targetType,
      targetId: data.targetId,
      rating: data.rating,
      reason: data.reason,
    },
  });
}

