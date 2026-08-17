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
// Schools with zero CUCAS presence (no deadline data anywhere) are left as-is
// — "Not specified" is honest; we never fabricate deadlines.
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

// Build the school -> deadline map from both crawl artifacts.
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

async function main() {
  const schoolDeadlines = buildSchoolDeadlines();
  console.log(`School-wide deadlines available for ${schoolDeadlines.size} schools.`);

  const records = await prisma.scholarship.findMany({
    where: { sourceUrl: { contains: "kaggle" }, deadline: null },
    select: { id: true, provider: true, title: true },
  });
  console.log(`Records without deadline: ${records.length}`);

  const updates: { id: string; deadline: Date }[] = [];
  const noDeadlineSchools = new Set<string>();
  const matchedProviders = new Set<string>();

  for (const r of records) {
    const dl = schoolDeadlines.get(normSchool(r.provider));
    if (!dl) {
      noDeadlineSchools.add(r.provider);
      continue;
    }
    matchedProviders.add(r.provider);
    updates.push({ id: r.id, deadline: dl });
  }

  console.log(`Will set deadline on ${updates.length} records across ${matchedProviders.size} providers.`);
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
