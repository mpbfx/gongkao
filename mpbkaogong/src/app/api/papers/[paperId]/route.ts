import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import { getPaperDetail } from "@/server/services/papers";

type RouteContext = {
  params: Promise<{
    paperId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { paperId } = await context.params;

    return apiOk(await getPaperDetail(paperId, user));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
