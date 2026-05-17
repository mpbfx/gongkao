import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { getRecentCoachDiagnosis } from "@/server/agent/coach/service";
import { apiErrorFromUnknown } from "@/server/services/api-errors";

export async function GET() {
  try {
    const user = await requireUser();

    return apiOk(await getRecentCoachDiagnosis(user));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

