import { requireUser } from "@/lib/auth/guards";
import { knowledgeMessageRequestSchema } from "@/server/agent/knowledge/schemas";
import { createKnowledgeUIMessageResponse } from "@/server/agent/knowledge/ui-message-stream";
import { apiErrorFromUnknown } from "@/server/services/api-errors";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    const body = knowledgeMessageRequestSchema.parse(await request.json());
    return createKnowledgeUIMessageResponse({ user, sessionId, prompt: body.prompt }, request.signal);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
