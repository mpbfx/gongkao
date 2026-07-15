import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { createAgentFeedback } from "@/server/agent/shared/feedback";
import { agentFeedbackSchema } from "@/server/agent/shared/schemas";
import { apiErrorFromUnknown } from "@/server/services/api-errors";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = agentFeedbackSchema.parse(await request.json());

    return apiOk(await createAgentFeedback(user, body));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

