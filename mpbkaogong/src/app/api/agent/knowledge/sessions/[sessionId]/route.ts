import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { deleteKnowledgeSession, getKnowledgeSession } from "@/server/agent/knowledge/service";
import { apiErrorFromUnknown } from "@/server/services/api-errors";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    return apiOk(await getKnowledgeSession(user, sessionId));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    return apiOk(await deleteKnowledgeSession(user, sessionId));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
