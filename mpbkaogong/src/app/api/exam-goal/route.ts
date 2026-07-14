import { apiOk } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/guards";
import { apiErrorFromUnknown } from "@/server/services/api-errors";
import {
  getExamGoal,
  setExamGoal,
  setExamGoalSchema,
} from "@/server/services/exam-goals";

export async function GET() {
  try {
    const user = await requireUser();
    return apiOk(await getExamGoal(user));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const input = setExamGoalSchema.parse(await request.json());
    return apiOk(await setExamGoal(user, input.targetPaperId));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
