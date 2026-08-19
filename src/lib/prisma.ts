import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Turso (serverless SQLite over libSQL). DATABASE_URL is the libsql:// URL;
// TURSO_AUTH_TOKEN is required for remote databases. Local dev can use a
// file: URL (authToken is ignored).
//
// Local file URLs are resolved relative to prisma/ (where the schema lives) to
// match the Prisma CLI — `prisma db push` with DATABASE_URL="file:./dev.db"
// creates prisma/dev.db, so the app and all scripts must open the same file.
// Without this the driver adapter resolves relative to the process CWD and
// the app would silently read a different (empty) database. Remote libsql://
// URLs pass through untouched.
function resolveDbUrl(raw: string): string {
  if (raw.startsWith("file:") && !raw.startsWith("file:/")) {
    return `file:${path.resolve("prisma", raw.slice("file:".length))}`;
  }
  return raw;
}

const adapter = new PrismaLibSQL({
  url: resolveDbUrl(process.env.DATABASE_URL ?? ""),
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : process.env.DEBUG_PRISMA ? ["query"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
