import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import {
  createSpecialPracticeSession,
  createSpecialSessionSchema,
} from "@/server/services/special-practice";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createSpecialSessionSchema.parse(await request.json());

    return apiOk(await createSpecialPracticeSession(user, body));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
