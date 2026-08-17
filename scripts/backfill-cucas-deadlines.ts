/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// CUCAS deadline backfill.
//
// Deadlines on CUCAS are school-wide: every program at a school shares one
// scholarship deadline (verified during the crawl). Records whose programs
// left the CUCAS catalog got a university-website URL in the officialUrl
// backfill but no deadline — this script applies the school-wide deadline
// captured from the live CUCAS site (deadlines.json + enriched-global.json).
//
// Schools with zero CUCAS presence get a deadline only where the school's
// OFFICIAL website publishes one (see UNI_PUBLISHED_DEADLINES — each entry
// was verified against the live site before being added, and carries its
// source URL). Everything else is left as-is: "Not specified" is honest; we
// never fabricate deadlines.
//
// Only records that STILL lack a deadline are touched.
//
// Usage:
//   npm run backfill:cucas-deadlines                 # apply
//   npm run backfill:cucas-deadlines -- --dry-run    # report only
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

// Deadlines published on the school's OWN website (recurring annual cycles).
// Verified live before being added — see the per-entry source URL.
// Month is 0-indexed (matches Date.UTC). Day is the calendar day.
// Level keys match the app's studyLevel slugs.
const UNI_PUBLISHED_DEADLINES: Record<string, { level: string; month: number; day: number; source: string }[]> = {
  // https://english.ncepu.edu.cn (International Education Institute) —
  //   "Application deadline is 30 th March" (CSC-CUP, master/PhD)
  //   "Application deadline is 30th April"  (BGS + IEIS, bachelor)
  "north china electric power university": [
    { level: "masters", month: 2, day: 30, source: "english.ncepu.edu.cn/Admissions" },
    { level: "phd", month: 2, day: 30, source: "english.ncepu.edu.cn/Admissions" },
    { level: "undergraduate", month: 3, day: 30, source: "english.ncepu.edu.cn/Admissions" },
  ],
};

function normSchool(name: string): string {
  return name
    .replace(/&/g, "and")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function parseDeadline(raw: string): Date | null {
  const m = raw.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{1,2}), (\d{4})/i);
  if (!m) return null;
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const month = months[m[1].slice(0, 3).toLowerCase()];
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (month === undefined || Number.isNaN(day) || Number.isNaN(year)) return null;
  return new Date(Date.UTC(year, month, day, 23, 59, 0));
}

// Build school -> deadline map from the CUCAS crawl artifacts.
// Where a school has multiple deadlines (different intake rounds), pick the
// most common one (mode) — that is the deadline the majority of programs use.
function buildSchoolDeadlines(): Map<string, Date> {
  const counts = new Map<string, Map<string, number>>();

  const add = (school: string, raw: string | null) => {
    if (!raw) return;
    const d = parseDeadline(raw);
    if (!d) return;
    const key = normSchool(school);
    const byDl = counts.get(key) ?? new Map<string, number>();
    const iso = d.toISOString();
    byDl.set(iso, (byDl.get(iso) ?? 0) + 1);
    counts.set(key, byDl);
  };

  try {
    const dj = JSON.parse(readFileSync("scrapers/cucas/deadlines.json", "utf-8")) as Record<string, string>;
    for (const [school, raw] of Object.entries(dj)) add(school, raw);
  } catch {
    console.error("Could not read scrapers/cucas/deadlines.json — skipping.");
  }
  try {
    const enr = JSON.parse(readFileSync("scrapers/cucas/enriched-global.json", "utf-8")) as {
      school: string;
      deadline: string | null;
    }[];
    for (const e of enr) add(e.school, e.deadline);
  } catch {
    console.error("Could not read scrapers/cucas/enriched-global.json — skipping.");
  }

  const out = new Map<string, Date>();
  for (const [school, byDl] of counts) {
    let best = "";
    let bestCount = 0;
    for (const [iso, c] of byDl) {
      if (c > bestCount) {
        bestCount = c;
        best = iso;
      }
    }
    if (best) out.set(school, new Date(best));
  }
  return out;
}

// Build school -> level -> deadline from UNI_PUBLISHED_DEADLINES.
// Recurring annual deadlines get the NEXT occurrence from today so the date
// stays in the future (a past date would wrongly mark the record expired
// even though the cycle repeats every year).
function buildUniPublishedDeadlines(): Map<string, Map<string, Date>> {
  const out = new Map<string, Map<string, Date>>();
  const today = new Date();
  for (const [school, entries] of Object.entries(UNI_PUBLISHED_DEADLINES)) {
    const byLevel = new Map<string, Date>();
    for (const e of entries) {
      let year = today.getUTCFullYear();
      const candidate = new Date(Date.UTC(year, e.month, e.day));
      if (candidate.getTime() < today.getTime()) year += 1;
      byLevel.set(e.level, new Date(Date.UTC(year, e.month, e.day, 23, 59, 0)));
    }
    out.set(normSchool(school), byLevel);
  }
  return out;
}

async function main() {
  const schoolDeadlines = buildSchoolDeadlines();
  const uniDeadlines = buildUniPublishedDeadlines();
  console.log(
    `Deadlines available: ${schoolDeadlines.size} schools (CUCAS crawl) + ` +
      `${uniDeadlines.size} schools (official university sites).`,
  );

  const records = await prisma.scholarship.findMany({
    where: { sourceUrl: { contains: "kaggle" }, deadline: null },
    select: { id: true, provider: true, title: true, studyLevels: true },
  });
  console.log(`Records without deadline: ${records.length}`);

  const updates: { id: string; deadline: Date }[] = [];
  const noDeadlineSchools = new Set<string>();
  const matchedProviders = new Set<string>();
  const uniMatched = new Set<string>();

  for (const r of records) {
    const school = normSchool(r.provider);
    // 1. Level-specific deadline published by the school itself (most precise).
    const uniByLevel = uniDeadlines.get(school);
    if (uniByLevel) {
      const raw = r.studyLevels;
      const levels = Array.isArray(raw)
        ? raw
        : typeof raw === "string"
          ? (JSON.parse(raw) as string[])
          : [];
      const dl = levels.map((l) => uniByLevel.get(l)).find((d) => d);
      if (dl) {
        uniMatched.add(r.provider);
        matchedProviders.add(r.provider);
        updates.push({ id: r.id, deadline: dl });
        continue;
      }
    }
    // 2. School-wide deadline from the CUCAS crawl.
    const dl = schoolDeadlines.get(school);
    if (dl) {
      matchedProviders.add(r.provider);
      updates.push({ id: r.id, deadline: dl });
      continue;
    }
    noDeadlineSchools.add(r.provider);
  }

  console.log(`Will set deadline on ${updates.length} records across ${matchedProviders.size} providers.`);
  if (uniMatched.size) console.log(`  (${uniMatched.size} providers from official university websites: ${[...uniMatched].join(", ")})`);
  console.log(`Providers with NO deadline data (left as-is): ${noDeadlineSchools.size}`);
  for (const s of [...noDeadlineSchools].sort()) console.log(`  - ${s}`);

  if (DRY_RUN) {
    for (const u of updates.slice(0, 8)) console.log(`  [dry-run] ${u.id} -> ${u.deadline.toISOString().slice(0, 10)}`);
    return;
  }

  let applied = 0;
  const BATCH = 200;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((u) =>
        prisma.scholarship.update({
          where: { id: u.id },
          data: { deadline: u.deadline, deadlineTimezone: "UTC", updatedAt: new Date() },
        }),
      ),
    );
    applied += batch.length;
    console.log(`Applied ${applied}/${updates.length}...`);
  }
  console.log(`Done: deadline set on ${applied} records.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
