/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// Turso migration — step 2: load the JSONL dump into the Turso database.
//
// Reads data/migration/*.jsonl (produced by migrate-dump.ts) and inserts into
// the DB referenced by DATABASE_URL (which should be the Turso libsql:// URL)
// using the project's Prisma client (libSQL adapter). Ids and timestamps are
// preserved exactly so slugs/URLs/deadlines survive the move. Inserts happen
// in foreign-key order; rows that already exist (by id) are skipped so the
// script is idempotent.
//
// Usage:
//   DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npx tsx scripts/migrate-load.ts
// ---------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

const IN_DIR = path.join(process.cwd(), "data", "migration");

function readTable(table: string): Record<string, any>[] {
  const file = path.join(IN_DIR, `${table}.jsonl`);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required (point it at the Turso DB)");

  // ---- Countries -----------------------------------------------------------
  const countries = readTable("Country");
  let n = 0;
  for (const c of countries) {
    try {
      await prisma.country.create({ data: { code: c.code, name: c.name, flag: c.flag ?? null, region: c.region ?? null } });
      n++;
    } catch (e: any) {
      if (e?.code === "P2002") { /* already present */ } else throw e;
    }
  }
  console.log(`Country: ${n} inserted (of ${countries.length})`);

  // ---- Universities ----------------------------------------------------------
  const universities = readTable("University");
  n = 0;
  for (const u of universities) {
    try {
      await prisma.university.create({
        data: {
          id: u.id, slug: u.slug, name: u.name, countryCode: u.countryCode,
          city: u.city ?? null, about: u.about ?? null, website: u.website ?? null,
          logoText: u.logoText ?? null, color: u.color ?? null,
          createdAt: u.createdAt, updatedAt: u.updatedAt,
        },
      });
      n++;
    } catch (e: any) {
      if (e?.code === "P2002") continue;
      throw e;
    }
  }
  console.log(`University: ${n} inserted (of ${universities.length})`);

  // ---- Scholarships ----------------------------------------------------------
  const scholarships = readTable("Scholarship");
  n = 0;
  for (const s of scholarships) {
    try {
      await prisma.scholarship.create({
        data: {
          id: s.id, slug: s.slug, title: s.title, description: s.description ?? null,
          provider: s.provider, providerType: s.providerType ?? "UNIVERSITY",
          universityId: s.universityId ?? null, countryCode: s.countryCode ?? null,
          city: s.city ?? null,
          studyLevels: s.studyLevels ?? "[]", fields: s.fields ?? "[]", degrees: s.degrees ?? "[]",
          eligibleNationalities: s.eligibleNationalities ?? "[]",
          fundingType: s.fundingType ?? "PARTIAL", benefits: s.benefits ?? "[]",
          amount: s.amount ?? null, currency: s.currency ?? null, duration: s.duration ?? null,
          deadline: s.deadline ?? null, deadlineTimezone: s.deadlineTimezone ?? null,
          applicationFee: s.applicationFee ?? null,
          languageRequirements: s.languageRequirements ?? "[]",
          academicRequirements: s.academicRequirements ?? null,
          ageRequirements: s.ageRequirements ?? null, workExperience: s.workExperience ?? null,
          requiredDocuments: s.requiredDocuments ?? "[]", applicationSteps: s.applicationSteps ?? "[]",
          officialUrl: s.officialUrl ?? null, sourceUrl: s.sourceUrl ?? null,
          featuredImage: s.featuredImage ?? null,
          recordType: s.recordType ?? "SCHOLARSHIP",
          verificationStatus: s.verificationStatus ?? "UNVERIFIED", status: s.status ?? "ACTIVE",
          lastVerifiedAt: s.lastVerifiedAt ?? null,
          isFeatured: s.isFeatured ?? false, isTrending: s.isTrending ?? false,
          views: s.views ?? 0,
          submittedByName: s.submittedByName ?? null, submittedEmail: s.submittedEmail ?? null,
          submittedNote: s.submittedNote ?? null,
          createdAt: s.createdAt, updatedAt: s.updatedAt,
        },
      });
      n++;
    } catch (e: any) {
      if (e?.code === "P2002") continue;
      throw e;
    }
  }
  console.log(`Scholarship: ${n} inserted (of ${scholarships.length})`);

  // ---- Users -----------------------------------------------------------------
  const users = readTable("User");
  n = 0;
  for (const u of users) {
    try {
      await prisma.user.create({
        data: {
          id: u.id, email: u.email, passwordHash: u.passwordHash, name: u.name ?? null,
          role: u.role ?? "USER", emailVerified: u.emailVerified ?? false,
          nationality: u.nationality ?? null, countryOfResidence: u.countryOfResidence ?? null,
          degreeLevel: u.degreeLevel ?? null, fieldOfStudy: u.fieldOfStudy ?? null,
          gpa: u.gpa ?? null, preferredDestination: u.preferredDestination ?? null,
          ieltsStatus: u.ieltsStatus ?? null, graduationYear: u.graduationYear ?? null,
          createdAt: u.createdAt, updatedAt: u.updatedAt,
        },
      });
      n++;
    } catch (e: any) {
      if (e?.code === "P2002") continue;
      throw e;
    }
  }
  console.log(`User: ${n} inserted (of ${users.length})`);

  // ---- SavedScholarship --------------------------------------------------------
  const saves = readTable("SavedScholarship");
  n = 0;
  for (const s of saves) {
    try {
      await prisma.savedScholarship.create({ data: { id: s.id, userId: s.userId, scholarshipId: s.scholarshipId, createdAt: s.createdAt } });
      n++;
    } catch (e: any) {
      if (e?.code === "P2002") continue;
      throw e;
    }
  }
  console.log(`SavedScholarship: ${n} inserted (of ${saves.length})`);

  // ---- Report -------------------------------------------------------------------
  const reports = readTable("Report");
  n = 0;
  for (const r of reports) {
    try {
      await prisma.report.create({
        data: {
          id: r.id, scholarshipId: r.scholarshipId, userId: r.userId ?? null,
          reason: r.reason, message: r.message ?? null, status: r.status ?? "OPEN",
          createdAt: r.createdAt,
        },
      });
      n++;
    } catch (e: any) {
      if (e?.code === "P2002") continue;
      throw e;
    }
  }
  console.log(`Report: ${n} inserted (of ${reports.length})`);

  // ---- Article ---------------------------------------------------------------------
  const articles = readTable("Article");
  n = 0;
  for (const a of articles) {
    try {
      await prisma.article.create({
        data: {
          id: a.id, slug: a.slug, title: a.title, excerpt: a.excerpt ?? null,
          category: a.category, author: a.author, readingTime: a.readingTime,
          publishedAt: a.publishedAt, image: a.image ?? null, body: a.body,
          relatedScholarships: a.relatedScholarships ?? "[]",
        },
      });
      n++;
    } catch (e: any) {
      if (e?.code === "P2002") continue;
      throw e;
    }
  }
  console.log(`Article: ${n} inserted (of ${articles.length})`);

  // ---- Session ----------------------------------------------------------------------
  const sessions = readTable("Session");
  n = 0;
  for (const s of sessions) {
    try {
      await prisma.session.create({
        data: { id: s.id, token: s.token, userId: s.userId, expiresAt: s.expiresAt, createdAt: s.createdAt },
      });
      n++;
    } catch (e: any) {
      if (e?.code === "P2002") continue;
      throw e;
    }
  }
  console.log(`Session: ${n} inserted (of ${sessions.length})`);

  console.log("load complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
