import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { createAgentNote, listAgentNotes } from "@/server/agent/notes/service";
import { apiErrorFromUnknown } from "@/server/services/api-errors";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const query = Object.fromEntries(new URL(request.url).searchParams.entries());
    return apiOk(await listAgentNotes(user, query));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    return apiOk(await createAgentNote(user, await request.json()));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
