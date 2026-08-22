/**
 * sync-crawl-to-turso.ts
 *
 * Imports deduplicated crawled records into Turso. Reads the import-ready file,
 * checks for existing duplicates via title+university matching, and inserts new ones.
 *
 * Run when Turso reads are available again (monthly cap reset or plan upgrade):
 *   npx tsx scripts/sync-crawl-to-turso.ts
 *   npx tsx scripts/sync-crawl-to-turso.ts --dry-run   # preview only
 *   npx tsx scripts/sync-crawl-to-turso.ts --limit 100  # import first 100 only
 */

import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

interface CrawlRecord {
  title: string;
  university: string;
  country: string;
  domain: string;
  sourceUrl: string;
  context: string;
  fields: string[];
  source: string;
}

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b20\d{2}\b/g, " ")
    .replace(
      /\b(?:at|the|of|for|and|programme|program|scholarship|scholarships|award|awards|grant|grants|fellowship|bursary|university|international)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function titlesMatch(crawled: string, existing: string): boolean {
  const a = normalizeTitle(crawled);
  const b = normalizeTitle(existing);
  if (!a || !b) return false;
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (short.length >= 6 && long.includes(short)) return true;
  const wa = a.split(" ");
  const wb = b.split(" ");
  if (!wa.length || !wb.length) return false;
  const wbSet = new Set(wb);
  const inter = wa.filter((w) => wbSet.has(w)).length;
  const union = new Set(wa.concat(wb)).size;
  return inter / union >= 0.6;
}

function mapLevel(title: string, context: string): string {
  const text = (title + " " + context).toLowerCase();
  if (/\bphd|doctoral|doctorate\b/.test(text)) return "PhD";
  if (/\bmaster'?s?|msc|ma |mba\b/.test(text)) return "Master's";
  if (/\bundergrad|bachelor'?s?|bsc|ba\b/.test(text)) return "Undergraduate";
  if (/\bpostdoc|postdoc/.test(text)) return "Postdoctoral";
  return "Not specified";
}

function mapFunding(title: string, context: string): string {
  const text = (title + " " + context).toLowerCase();
  if (/\bfully[- ]funded|full[- ]cost|covers? (?:all |full )?tuition|tuition(?: and)? (?:fees?|waiver)|scholarship award/i.test(text)) return "Fully Funded";
  if (/\bpartial|partially|contribution|tuition reduction|fee (?:remission|reduction|waiver)/i.test(text)) return "Partial Funding";
  if (/\btuition[- ]?free|no tuition/i.test(text)) return "Fee Waiver";
  return "Not specified";
}

function mapProviderType(title: string, domain: string): string {
  const t = title.toLowerCase();
  if (/government|csc|mext|chevening|fulbright|daad|erasmus|govt/i.test(t)) return "Government";
  if (/foundation|fund|trust|institute|society/i.test(t)) return "Foundation";
  if (/company|corp|inc|business|industry/i.test(t)) return "Corporate";
  return "University";
}

async function main() {
  console.log("Loading import-ready records...");
  const lines = readFileSync("data/uni_crawl/import-ready.jsonl", "utf8")
    .split("\n")
    .filter((l) => l.trim());
  const records: CrawlRecord[] = lines.map((l) => JSON.parse(l));
  console.log(`Loaded ${records.length} records`);

  const toImport = records.slice(0, LIMIT);
  console.log(`Processing ${toImport.length} records${DRY_RUN ? " (dry-run)" : ""}`);

  // Load existing ACTIVE titles from DB for dedup
  console.log("Loading existing records from DB for dedup...");
  const existing = await prisma.scholarship.findMany({
    where: { status: "ACTIVE", recordType: "SCHOLARSHIP" },
    select: { title: true, university: { select: { name: true } } },
  });
  console.log(`Found ${existing.length} existing ACTIVE records`);

  // Build lookup: normalized title → set of university names
  const existingLookup = new Map<string, Set<string>>();
  for (const e of existing) {
    const norm = normalizeTitle(e.title);
    if (!existingLookup.has(norm)) existingLookup.set(norm, new Set());
    existingLookup.get(norm)!.add(e.university?.name?.toLowerCase() || "");
  }

  let skipped = 0;
  let imported = 0;
  let errors = 0;
  const skippedReasons: Record<string, number> = {};

  // Cache university lookups
  const uniCache = new Map<string, string>(); // name → id

  for (const rec of toImport) {
    // Check if this title+university already exists
    let isDup = false;
    const normTitle = normalizeTitle(rec.title);
    const uniLower = rec.university.toLowerCase();

    // Exact match check
    if (existingLookup.has(normTitle)) {
      const unis = existingLookup.get(normTitle)!;
      if (unis.has(uniLower) || unis.size === 0) {
        isDup = true;
      }
    }

    // Fuzzy match check against all existing
    if (!isDup) {
    for (const existingEntry of Array.from(existingLookup.entries())) {
      if (
        existingEntry[1].has(uniLower) &&
        titlesMatch(rec.title, existingEntry[0])
      ) {
        isDup = true;
        break;
      }
    }
    }

    if (isDup) {
      skipped++;
      skippedReasons["already_exists"] = (skippedReasons["already_exists"] || 0) + 1;
      continue;
    }

    // Find or note university
    if (!uniCache.has(uniLower)) {
      const uni = await prisma.university.findFirst({
        where: { name: { contains: rec.university } },
        select: { id: true },
      });
      uniCache.set(uniLower, uni?.id || "");
    }
    const universityId = uniCache.get(uniLower);

    if (!DRY_RUN) {
      try {
        await prisma.scholarship.create({
          data: {
            title: rec.title,
            slug: rec.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
              .slice(0, 120),
            status: "PENDING", // Needs admin review
            recordType: "SCHOLARSHIP",
            universityId: universityId || undefined,
            description: rec.context?.slice(0, 2000) || "",
            officialUrl: rec.sourceUrl || undefined,
            sourceUrl: rec.sourceUrl || undefined,
            source: "university-direct-crawl",
            eligibleNationalities: "ALL",
            studyLevel: mapLevel(rec.title, rec.context),
            fundingType: mapFunding(rec.title, rec.context),
            providerType: mapProviderType(rec.title, rec.domain),
            isFeatured: false,
            views: 0,
          },
        });
        imported++;
        if (imported % 500 === 0) console.log(`  ... imported ${imported}`);
      } catch (e: any) {
        errors++;
        if (errors <= 5) console.error(`  Error on "${rec.title}": ${e.message}`);
      }
    } else {
      imported++;
    }
  }

  console.log(`\n=== SYNC RESULTS ===`);
  console.log(`Total processed: ${toImport.length}`);
  console.log(`Imported (new): ${imported}`);
  console.log(`Skipped (duplicates): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`\nSkipped reasons:`, skippedReasons);

  if (DRY_RUN) {
    console.log(`\n[dry-run] No records were written. Remove --dry-run to import.`);
  } else {
    console.log(`\nImported records are PENDING — approve in /admin to make them ACTIVE.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
