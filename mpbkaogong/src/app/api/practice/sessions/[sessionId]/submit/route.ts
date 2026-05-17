import { after } from "next/server";

import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { getTutorAutoReviewConfig } from "@/server/agent/shared/config";
import { autoAnalyzeSubmittedSessionMistakes } from "@/server/agent/tutor/service";
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
    const result = await submitPracticeSession(user, sessionId, body);

    after(async () => {
      try {
        const config = await getTutorAutoReviewConfig();

        if (!config.enabled || result.wrongCount <= 0) {
          return;
        }

        await autoAnalyzeSubmittedSessionMistakes(user, sessionId, {
          maxQuestions: config.maxQuestionsPerSession,
        });
      } catch (error) {
        console.error("Auto mistake review task failed", error);
      }
    });

    return apiOk(result);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
