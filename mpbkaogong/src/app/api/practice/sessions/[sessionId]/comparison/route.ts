import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import { getPracticeComparison } from "@/server/services/practice-comparison";

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    return apiOk(await getPracticeComparison(user, sessionId));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
