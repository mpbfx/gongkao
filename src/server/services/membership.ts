import { prisma } from "@/lib/db/prisma";
import type { AppUserRole } from "@/lib/auth/guards";

const elevatedRoles: AppUserRole[] = ["ADMIN", "SUPER_ADMIN"];

export async function hasActiveMembership(userId: string, role: AppUserRole = "USER") {
  if (elevatedRoles.includes(role)) {
    return true;
  }

  const count = await prisma.membership.count({
    where: {
      userId,
      status: "ACTIVE",
      endedAt: {
        gt: new Date(),
      },
    },
  });

  return count > 0;
}

/** 只拿得到 userId 的调用方（如 Agent 工具）用这个入口，自行补齐角色。 */
export async function hasActiveMembershipForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return hasActiveMembership(userId, (user?.role as AppUserRole) ?? "USER");
}
