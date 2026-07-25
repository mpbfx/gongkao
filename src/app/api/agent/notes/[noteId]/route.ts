import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import {
  getAgentNote,
  trashAgentNote,
  updateAgentNote,
} from "@/server/agent/notes/service";
import { apiErrorFromUnknown } from "@/server/services/api-errors";

type RouteContext = { params: Promise<{ noteId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { noteId } = await context.params;
    return apiOk(await getAgentNote(user, noteId));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { noteId } = await context.params;
    return apiOk(await updateAgentNote(user, noteId, await request.json()));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { noteId } = await context.params;
    return apiOk(await trashAgentNote(user, noteId));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
