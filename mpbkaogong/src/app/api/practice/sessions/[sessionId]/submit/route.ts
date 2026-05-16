import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import { submitPracticeSession, submitSessionSchema } from "@/server/services/practice";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    const body = submitSessionSchema.parse(await request.json());

    return apiOk(await submitPracticeSession(user, sessionId, body));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
