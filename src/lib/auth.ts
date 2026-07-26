import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { enforceRateLimit, resetRateLimit } from "@/server/rate-limit/limiter";
import { loginAttemptRules } from "@/server/rate-limit/policies";

/** 同时按邮箱与来源 IP 计量，单独用任一维度都容易被绕开。 */
function loginRateLimitSubjects(email: string, request: unknown) {
  const subjects = [`email:${email}`];
  const headers = (request as { headers?: Headers } | undefined)?.headers;
  const forwardedFor = headers?.get?.("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || headers?.get?.("x-real-ip")?.trim();

  if (ip) {
    subjects.push(`ip:${ip}`);
  }

  return subjects;
}

const credentialsSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
});

const dummyPasswordHash =
  "$2b$10$8J2b9yE.wfQ.xnKMBEKAvuH2dpF3X2bjy.7p0Sd8fnI9hrvMEC4iq";

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        // 限流放在 authorize 里而不是登录 Server Action 里：
        // /api/auth/callback/credentials 是公开端点，攻击者会绕过页面直接打它。
        const rules = loginAttemptRules();
        const subjects = loginRateLimitSubjects(parsed.data.email, request);

        for (const subject of subjects) {
          await enforceRateLimit("login", subject, rules);
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            passwordHash: true,
            role: true,
          },
        });

        const passwordHash = user?.passwordHash ?? dummyPasswordHash;
        const isValidPassword = await bcrypt.compare(parsed.data.password, passwordHash);

        if (!user || !user.passwordHash || !isValidPassword) {
          return null;
        }

        // 验证通过即清零，把语义从「N 次尝试」变成「连续失败 N 次」。
        await Promise.all(
          subjects.map((subject) => resetRateLimit("login", subject, rules))
        );

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const sessionUser = session.user as typeof session.user & {
          id?: string;
          role?: "USER" | "ADMIN" | "SUPER_ADMIN";
        };
        const tokenData = token as typeof token & {
          id?: string;
          role?: "USER" | "ADMIN" | "SUPER_ADMIN";
        };

        sessionUser.id = tokenData.id ?? token.sub ?? "";
        sessionUser.role = tokenData.role ?? "USER";
      }

      return session;
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      if (new URL(url).origin === baseUrl) {
        return url;
      }

      return baseUrl;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
