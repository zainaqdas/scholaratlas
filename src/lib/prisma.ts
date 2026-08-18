import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Turso (serverless SQLite over libSQL). DATABASE_URL is the libsql:// URL;
// TURSO_AUTH_TOKEN is required for remote databases. Local dev can use a
// file: URL (authToken is ignored).
const adapter = new PrismaLibSQL({
  url: process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : process.env.DEBUG_PRISMA ? ["query"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
