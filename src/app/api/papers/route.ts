import { apiOk } from "@/lib/api/response";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import { listPapers, paperListQuerySchema } from "@/server/services/papers";

export async function GET(request: Request) {
  try {
    const searchParams = Object.fromEntries(new URL(request.url).searchParams);
    const query = paperListQuerySchema.parse(searchParams);

    return apiOk(await listPapers(query));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
