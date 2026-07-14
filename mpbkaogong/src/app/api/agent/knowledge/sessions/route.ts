import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { createKnowledgeSessionSchema } from "@/server/agent/knowledge/schemas";
import { createKnowledgeSession, listKnowledgeSessions } from "@/server/agent/knowledge/service";
import { apiErrorFromUnknown } from "@/server/services/api-errors";

export async function GET() {
  try {
    return apiOk(await listKnowledgeSessions(await requireUser()));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createKnowledgeSessionSchema.parse(await request.json().catch(() => ({})));
    return apiOk(await createKnowledgeSession(user, body.title));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
