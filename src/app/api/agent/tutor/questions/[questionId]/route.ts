import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import {
  getQuestionTutorHistory,
} from "@/server/agent/tutor/service";
import { tutorRequestSchema } from "@/server/agent/tutor/schemas/tutor-schemas";
import { createTutorUIMessageResponse } from "@/server/agent/tutor/ui-message-stream";
import { apiErrorFromUnknown } from "@/server/services/api-errors";

type RouteContext = {
  params: Promise<{
    questionId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { questionId } = await context.params;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId")?.trim() || undefined;

    return apiOk(await getQuestionTutorHistory({ user, questionId, sessionId }));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { questionId } = await context.params;
    const body = tutorRequestSchema.parse(await request.json());

    return createTutorUIMessageResponse({ user, questionId, ...body }, request.signal);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
