import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { restoreAgentNote } from "@/server/agent/notes/service";
import { apiErrorFromUnknown } from "@/server/services/api-errors";

type RouteContext = { params: Promise<{ noteId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { noteId } = await context.params;
    return apiOk(await restoreAgentNote(user, noteId));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
