import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import { createPaperPracticeSession, createPaperSessionSchema } from "@/server/services/practice";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createPaperSessionSchema.parse(await request.json());

    return apiOk(await createPaperPracticeSession(user, body.paperId));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
