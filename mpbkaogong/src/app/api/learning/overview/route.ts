import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import { getLearningOverview } from "@/server/services/learning-overview";

export async function GET() {
  try {
    const user = await requireUser();

    return apiOk(await getLearningOverview(user));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
