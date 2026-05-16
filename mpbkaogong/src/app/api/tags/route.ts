import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import { listActiveTagsTree } from "@/server/services/tags";

export async function GET() {
  try {
    await requireUser();

    return apiOk(await listActiveTagsTree());
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
