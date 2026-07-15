import { apiError, apiOk } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/guards";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("UNAUTHORIZED", "请先登录", 401);
  }

  return apiOk({ user });
}

