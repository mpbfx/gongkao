import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import { resolveWrongQuestion } from "@/server/services/wrong-questions";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    return apiOk(await resolveWrongQuestion(user, id));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
