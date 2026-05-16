import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import { listPracticeRecords, recordsQuerySchema } from "@/server/services/records";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const searchParams = Object.fromEntries(new URL(request.url).searchParams);
    const query = recordsQuerySchema.parse(searchParams);

    return apiOk(await listPracticeRecords(user, query));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
