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
