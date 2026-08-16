/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// CUCAS enrichment updater.
//
// Reads scrapers/cucas/enriched.json (produced by enrich_cucas.py — real
// program URLs + school-wide scholarship deadlines from the live CUCAS site)
// and backfills officialUrl + deadline on the imported Kaggle records.
//
// Matching: records were imported with titles like
//   "{Program} — {University} ({Level})"
// and enriched entries carry {school, program, url, deadline}. We match by
// normalized (school name, program name), stripping degree prefixes
// ("B. A. in", "BSc", "M.Eng." ...) and punctuation from both sides.
//
// Only updates records that currently lack officialUrl or deadline; records
// that don't match anything are left untouched (still PENDING/UNVERIFIED,
// admin can enrich or reject them).
//
// Usage:
//   npm run enrich:cucas                  # apply all matches
//   npm run enrich:cucas -- --dry-run     # report only, no writes
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const flagValue = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const FILE = flagValue("file") ?? "scrapers/cucas/enriched.json";
const DRY_RUN = args.includes("--dry-run");
const LIMIT = Number(flagValue("limit") ?? 0) || 0;

interface EnrichedEntry {
  school: string;
  schoolId: number;
  program: string;
  url: string;
  deadline: string | null;
}

// --- school-slug validation ---------------------------------------------------
// CUCAS program URLs embed the school as a slug, e.g.
//   /china_scholarship/Qingdao-University_Physics_scholarship_26_123&lang=en
// The crawler occasionally stores entries under the wrong school name (the
// school-filtered listing falls back to a "featured programs" set when the
// filter fails server-side). We refuse to assign a URL whose school slug does
// not match the record's university — a wrong application link is worse than
// none.
function schoolSlugFromUrl(url: string): string {
  const m = url.match(/\/china_scholarships?\/([A-Za-z0-9-]+)_/);
  return m ? m[1] : "";
}

function toSlug(s: string): string {
  let t = s.replace(/&/g, "-").replace(/'/g, "-");
  t = t.replace(/[^a-z0-9-]+/gi, "-");
  t = t.replace(/-+/g, "-").toLowerCase();
  return t.replace(/^-|-$/g, "");
}

function urlMatchesSchool(entry: EnrichedEntry): boolean {
  const us = schoolSlugFromUrl(entry.url);
  return us !== "" && toSlug(entry.school) === toSlug(us);
}

// --- name normalization ------------------------------------------------------
// Degree prefixes that appear in the Kaggle titles but not in CUCAS program
// names (e.g. "B. A. in English" -> "English", "BSc in Statistics" -> ...).
const DEGREE_PREFIX =
  /^(b\.?\s*a\.?|b\.?\s*sc\.?|b\.?\s*eng\.?|b\.?\s*tech\.?|b\.?\s*b\.?\s*a\.?|m\.?\s*a\.?|m\.?\s*sc\.?|m\.?\s*eng\.?|m\.?\s*ba\.?|m\.?\s*phil\.?|ph\.?\s*d\.?|d\.?\s*eng\.?|doctor of|bachelor(?:'s)? of|master(?:'s)? of)\s*(in\s+|of\s+)?/i;

function normProgram(name: string): string {
  let s = name;
  // Decode HTML entities (&amp; -> & -> and) before anything else.
  s = s.replace(/&amp;/g, "&").replace(/&/g, "and");
  // CUCAS prefixes some listings with a track code, e.g. "(1+4)Accounting".
  s = s.replace(/^\(\d+\+\d+\)\s*/, "");
  s = s.replace(DEGREE_PREFIX, "");
  s = s.toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, " ");
  return s.trim().replace(/\s+/g, " ");
}

function normSchool(name: string): string {
  let s = name.replace(/&/g, "and");
  s = s.toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, " ");
  return s.trim().replace(/\s+/g, " ");
}

// --- date parsing -------------------------------------------------------------
function parseDeadline(raw: string | null): Date | null {
  if (!raw) return null;
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

async function main() {
  let raw: string;
  try {
    raw = readFileSync(FILE, "utf-8");
  } catch {
    console.error(`Cannot read ${FILE}. Run the crawler first: scrapers/cucas/enrich_cucas.py`);
    process.exit(1);
  }
  const entries: EnrichedEntry[] = JSON.parse(raw);
  console.log(`Read ${entries.length} enriched entries from ${FILE}.`);

  // Index by school -> { normalized program -> entry }. Entries whose URL
  // school slug does not match the school name are contaminated (fallback
  // listing) and are skipped entirely.
  const bySchool = new Map<string, Map<string, EnrichedEntry>>();
  let skippedContaminated = 0;
  for (const e of entries) {
    if (!e.url) continue;
    if (!urlMatchesSchool(e)) {
      skippedContaminated += 1;
      continue;
    }
    const schoolKey = normSchool(e.school);
    if (!bySchool.has(schoolKey)) bySchool.set(schoolKey, new Map());
    const progKey = normProgram(e.program);
    bySchool.get(schoolKey)!.set(progKey, e);
  }
  console.log(`Indexed ${bySchool.size} schools (skipped ${skippedContaminated} contaminated entries).`);

  // Load all imported CUCAS records (source = Kaggle) that need enrichment.
  const records = await prisma.scholarship.findMany({
    where: {
      sourceUrl: { contains: "kaggle" },
      OR: [{ officialUrl: null }, { deadline: null }],
    },
    select: { id: true, title: true, provider: true, officialUrl: true, deadline: true },
  });
  console.log(`Records needing enrichment: ${records.length}`);

  const updates: { id: string; officialUrl: string | null; deadline: Date | null }[] = [];
  let matched = 0;
  let noProgramMatch = 0;
  let noSchoolMatch = 0;

  for (const r of records) {
    // Title: "{Program} — {University} ({Level})"
    const sep = r.title.indexOf(" — ");
    const progPart = sep > 0 ? r.title.slice(0, sep) : r.title;
    const schoolKey = normSchool(r.provider);
    const schoolMap = bySchool.get(schoolKey);
    if (!schoolMap) {
      noSchoolMatch += 1;
      continue;
    }

    const progKey = normProgram(progPart);
    let entry = schoolMap.get(progKey);

    // Fallback: substring containment (one side contains the other), prefer
    // the longest CUCAS program name that matches. Only within the same
    // school (schoolMap is already school-validated).
    if (!entry) {
      let best: EnrichedEntry | null = null;
      for (const [key, e] of schoolMap) {
        if (!key) continue;
        if (key === progKey || (key.length >= 4 && (progKey.includes(key) || key.includes(progKey)))) {
          if (!best || key.length > normProgram(best.program).length) best = e;
        }
      }
      entry = best ?? undefined;
    }

    if (!entry) {
      noProgramMatch += 1;
      continue;
    }

    const deadline = parseDeadline(entry.deadline);
    if (!r.officialUrl || !r.deadline) {
      updates.push({
        id: r.id,
        officialUrl: r.officialUrl ?? entry.url,
        deadline: r.deadline ?? deadline,
      });
      matched += 1;
    }
  }

  console.log(`Matched: ${matched} | No school match: ${noSchoolMatch} | No program match: ${noProgramMatch}`);

  if (DRY_RUN) {
    console.log(`[dry-run] Would update ${updates.length} records.`);
    for (const u of updates.slice(0, LIMIT || 8)) {
      console.log(`  - ${u.id} -> url=${u.officialUrl} deadline=${u.deadline?.toISOString().slice(0, 10)}`);
    }
    return;
  }

  let applied = 0;
  let limited = updates;
  if (LIMIT > 0) limited = updates.slice(0, LIMIT);
  for (const u of limited) {
    await prisma.scholarship.update({
      where: { id: u.id },
      data: {
        officialUrl: u.officialUrl,
        deadline: u.deadline,
        deadlineTimezone: u.deadline ? "UTC" : null,
        updatedAt: new Date(),
      },
    });
    applied += 1;
  }
  console.log(`Applied: ${applied} updates.`);
}

main()
  .catch((err) => {
    console.error("Enrichment failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
