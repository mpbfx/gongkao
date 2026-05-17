import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { tutorRequestSchema } from "@/server/agent/shared/schemas";
import { explainQuestionWithTutor } from "@/server/agent/tutor/service";
import { apiErrorFromUnknown } from "@/server/services/api-errors";

type RouteContext = {
  params: Promise<{
    questionId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { questionId } = await context.params;
    const body = tutorRequestSchema.parse(await request.json());

    return apiOk(await explainQuestionWithTutor({ user, questionId, ...body }));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

