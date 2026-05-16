import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import { getPracticeSessionDetail } from "@/server/services/practice";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;

    return apiOk(await getPracticeSessionDetail(user, sessionId));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
