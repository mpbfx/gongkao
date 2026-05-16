import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import {
  createDailyPracticeSession,
  createDailySessionSchema,
} from "@/server/services/daily-practice";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createDailySessionSchema.parse(await request.json());

    return apiOk(await createDailyPracticeSession(user, body));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
