import { z } from "zod";

import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import { NotFoundError } from "@/server/services/errors";

const reflectionSchema = z.object({ reflectionText: z.string().trim().max(5000) });

export async function PATCH(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    const input = reflectionSchema.parse(await request.json());
    const updated = await prisma.practiceSession.updateMany({
      where: { id: sessionId, userId: user.id, status: "SUBMITTED" },
      data: { reflectionText: input.reflectionText || null },
    });
    if (updated.count === 0) throw new NotFoundError("练习记录不存在");
    return apiOk({ id: sessionId, reflectionText: input.reflectionText || null });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
