import { apiOk } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import { listPapers, paperListQuerySchema } from "@/server/services/papers";

export async function GET(request: Request) {
  try {
    const searchParams = Object.fromEntries(new URL(request.url).searchParams);
    const query = paperListQuerySchema.parse(searchParams);

    const user = await getCurrentUser();

    return apiOk(await listPapers(query, user?.id));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
