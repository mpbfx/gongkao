import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { config as loadDotenv } from "dotenv";

import { PrismaClient } from "@/generated/prisma/client";

if (!process.env.DATABASE_URL) {
  loadDotenv({ path: ".env.local", quiet: true });
  loadDotenv({ quiet: true });
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to initialize Prisma.");
}

const getDatabaseName = (url: string) => {
  try {
    return new URL(url).pathname.replace(/^\//, "") || undefined;
  } catch {
    return undefined;
  }
};

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const createPrismaClient = () => {
  const adapter = new PrismaMariaDb(databaseUrl, {
    database: getDatabaseName(databaseUrl),
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
