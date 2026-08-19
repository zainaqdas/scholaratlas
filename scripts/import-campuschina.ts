import { createManySkipDuplicates } from "./lib/insert-many";
import { renewalDecision, applyRenewals } from "./lib/insert-or-renew";
/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// Campus China importer.
//
// Reads normalized records produced by the campuschina scraper
// (scrapers/campuschina/scrape.py -> output.json), dedupes against existing
// records by source URL, and inserts new listings as PENDING for admin review.
//
// Usage:
//   npm run import:campuschina -- --file /path/to/output.json
//   npm run import:campuschina -- --file out.json --dry-run
//   npm run import:campuschina -- --file out.json --limit 10
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const flagValue = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const FILE = flagValue("file") ?? "scrapers/campuschina/output.json";
const LIMIT = Number(flagValue("limit") ?? 0) || 0;
const DRY_RUN = args.includes("--dry-run");

interface CampusChinaRecord {
  title: string;
  slug?: string;
  provider?: string;
  description?: string;
  officialUrl: string;
  sourceUrl?: string;
  countryCode?: string;
  studyLevels?: string[];
  createdAt?: string;
}

function slugify(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  return base || "campuschina-listing";
}

async function main() {
  let raw: string;
  try {
    raw = readFileSync(FILE, "utf-8");
  } catch {
    console.error(`Cannot read ${FILE}. Run the scraper first: scrapers/campuschina/scrape.py`);
    process.exit(1);
  }
  const records: CampusChinaRecord[] = JSON.parse(raw);
  console.log(`Read ${records.length} records from ${FILE}.`);

  const importedAt = new Date();
  const normalized = records
    .filter((r) => r.title && r.officialUrl)
    .map((r) => ({
      title: r.title,
      slug: r.slug ?? slugify(r.title),
      provider: r.provider || "China Scholarship Council",
      description: r.description || r.title,
      officialUrl: r.officialUrl,
      sourceUrl: r.sourceUrl || r.officialUrl,
      countryCode: r.countryCode ?? "CN",
      studyLevels: JSON.stringify(r.studyLevels ?? []),
      status: "PENDING",
      verificationStatus: "UNVERIFIED",
      submittedNote: `Imported from campuschina.org crawl on ${importedAt.toISOString().slice(0, 10)}`,
      createdAt: r.createdAt ? new Date(r.createdAt) : importedAt,
    }));

  if (DRY_RUN) {
    console.log(`[dry-run] Would insert ${normalized.length} new records.`);
    for (const r of normalized.slice(0, LIMIT || 5)) {
      console.log(`  - ${r.title} | ${r.provider} | ${r.sourceUrl}`);
    }
    return;
  }

  // Dedupe by source URL; re-crawled expired records are renewed in place so
  // they come back to the catalogue instead of being skipped as duplicates.
  const urls = normalized.map((r) => r.sourceUrl);
  const existing = await prisma.scholarship.findMany({
    where: { sourceUrl: { in: urls } },
    select: { id: true, sourceUrl: true, status: true, deadline: true },
  });
  const existingByUrl = new Map(existing.map((e) => [e.sourceUrl as string, e]));
  const fresh: any[] = [];
  const renewals: { id: string; data: any }[] = [];
  const deadlineUpdates: { id: string; deadline: Date }[] = [];
  let unchanged = 0;
  for (const r of normalized) {
    const match = existingByUrl.get(r.sourceUrl);
    if (!match) {
      fresh.push(r);
      continue;
    }
    const decision = renewalDecision(match, r);
    if (decision.kind === "renew") renewals.push(decision);
    else if (decision.kind === "update-deadline") deadlineUpdates.push(decision);
    else unchanged++;
  }
  const skipped = unchanged;

  let toInsert = fresh;
  if (LIMIT > 0) toInsert = fresh.slice(0, LIMIT);

  // Unique slugs
  const existingSlugs = new Set(
    (
      await prisma.scholarship.findMany({
        where: { slug: { in: toInsert.map((r) => r.slug) } },
        select: { slug: true },
      })
    ).map((e) => e.slug)
  );
  const used = new Set(existingSlugs);
  const finalData = toInsert.map((r) => {
    let slug = r.slug;
    if (used.has(slug)) slug = `${slug}-${Date.now().toString(36)}`;
    used.add(slug);
    return { ...r, slug };
  });

  let inserted = 0;
  if (finalData.length) {
    inserted = await createManySkipDuplicates(prisma.scholarship, finalData);
  }

  const { renewed: rn, deadlineUpdated: du } = await applyRenewals(renewals, deadlineUpdates);
  console.log(`New: ${toInsert.length} | Skipped (already imported): ${skipped} | Inserted: ${inserted} | Renewed: ${rn} | Deadlines updated: ${du}`);
  console.log(inserted > 0 ? "Imported records are PENDING — review them at /admin." : "Nothing new to import.");
}

main()
  .catch((err) => {
    console.error("Import failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
