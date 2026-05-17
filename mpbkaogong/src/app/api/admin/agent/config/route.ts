import { apiOk } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth/guards";
import { getCoachConfig, upsertCoachConfig } from "@/server/agent/shared/config";
import { coachConfigSchema } from "@/server/agent/shared/schemas";
import { apiErrorFromUnknown } from "@/server/services/api-errors";

export async function GET() {
  try {
    await requireAdmin();

    return apiOk(await getCoachConfig());
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAdmin();
    const body = coachConfigSchema.parse(await request.json());

    return apiOk(await upsertCoachConfig(user, body));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

