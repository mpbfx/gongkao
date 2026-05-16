import { auth } from "@/lib/auth";

export type AppUserRole = "USER" | "ADMIN" | "SUPER_ADMIN";

export type AuthenticatedUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: AppUserRole;
};

export class UnauthorizedError extends Error {
  constructor(message = "请先登录") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "无权限") {
    super(message);
    this.name = "ForbiddenError";
  }
}

const adminRoles: AppUserRole[] = ["ADMIN", "SUPER_ADMIN"];

export async function getCurrentUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    role: session.user.role ?? "USER",
  } satisfies AuthenticatedUser;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (!adminRoles.includes(user.role)) {
    throw new ForbiddenError();
  }

  return user;
}

