import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { startAgentRecommendation } from "@/server/agent/coach/service";
import { apiErrorFromUnknown } from "@/server/services/api-errors";

type RouteContext = {
  params: Promise<{
    recommendationId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { recommendationId } = await context.params;

    return apiOk(await startAgentRecommendation(user, recommendationId));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

