import { apiOk } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import { getTodayDailyPractice } from "@/server/services/daily-practice";

export async function GET() {
  try {
    const user = await getCurrentUser();

    return apiOk(await getTodayDailyPractice(user));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
