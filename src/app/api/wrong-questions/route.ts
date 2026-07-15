import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import { listWrongQuestions, wrongQuestionsQuerySchema } from "@/server/services/wrong-questions";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const query = wrongQuestionsQuerySchema.parse(Object.fromEntries(searchParams));

    return apiOk(await listWrongQuestions(user, query));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
