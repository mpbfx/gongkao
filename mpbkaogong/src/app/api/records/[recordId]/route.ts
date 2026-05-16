import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import { getPracticeRecordDetail } from "@/server/services/records";

type RouteContext = {
  params: Promise<{
    recordId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { recordId } = await context.params;

    return apiOk(await getPracticeRecordDetail(user, recordId));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
