import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import {
  createWrongQuestionPracticeSession,
  createWrongSessionSchema,
} from "@/server/services/wrong-questions";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createWrongSessionSchema.parse(await request.json());

    return apiOk(await createWrongQuestionPracticeSession(user, body));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
