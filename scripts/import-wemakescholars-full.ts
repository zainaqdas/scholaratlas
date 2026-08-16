/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// wemakescholars.com FULL catalogue importer.
//
// The global listing (/scholarship?page=N) holds ~20,474 scholarships —
// far more than any single country page. This importer:
//
//   Phase 1 (listing): crawl all listing pages, collect slugs, checkpoint to
//                      data/wms-global-slugs.json (resumable)
//   Phase 2 (details): fetch each detail page concurrently, parse structured
//                      fields, assign the destination country from the
//                      "Scholarship can be taken at" field, checkpoint parsed
//                      records to data/wms-global-details.jsonl (resumable)
//   Phase 3 (insert):  bulk-insert as PENDING/UNVERIFIED, deduped by source
//                      URL, China-destination records excluded (already well
//                      covered by the CUCAS/cscouncil/campuschina imports —
//                      avoids cross-source duplicates).
//
// Usage:
//   npm run import:wms-full -- --listing-only   # Phase 1 only
//   npm run import:wms-full -- --dry-run        # report only, no insert
//   npm run import:wms-full -- --limit 50       # cap detail fetches
// ---------------------------------------------------------------------------

import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/utils";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LISTING_ONLY = args.includes("--listing-only");
const INSERT_ONLY = args.includes("--insert-only");
const LIMIT = Number(args[args.indexOf("--limit") + 1] ?? 0) || 0;

const SLUGS_FILE = path.join(process.cwd(), "data", "wms-global-slugs.json");
const DETAILS_FILE = path.join(process.cwd(), "data", "wms-global-details.jsonl");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const BASE = "https://www.wemakescholars.com";

interface WmsRecord {
  title: string;
  slug: string;
  provider: string;
  fundingType: string;
  deadline: Date | null;
  amount: string | null;
  description: string;
  officialUrl: string | null;
  sourceUrl: string;
  countryCode: string | null;
  levels: string[];
}

// keyword -> country code (order matters: longer phrases first)
const RULES: [RegExp, string][] = [
  [/united states of america|united states|usa|\bu\.?s\.?a\.?\b|(?:^|[^a-z])us(?:$|[^a-z])|american universities?/i, "US"],
  [/united kingdom|\buk\b|britain|england|scotland|wales|northern ireland/i, "GB"],
  [/germany|german universities?/i, "DE"],
  [/france|french universities?/i, "FR"],
  [/canada|canadian universities?/i, "CA"],
  [/australia|australian universities?/i, "AU"],
  [/ireland|irish universities?/i, "IE"],
  [/netherlands|holland|dutch universities?/i, "NL"],
  [/sweden|swedish universities?/i, "SE"],
  [/norway|norwegian universities?/i, "NO"],
  [/finland|finnish universities?/i, "FI"],
  [/switzerland|swiss universities?/i, "CH"],
  [/italy|italian universities?/i, "IT"],
  [/spain|spanish universities?/i, "ES"],
  [/china|chinese universities?/i, "CN"],
  [/india|indian universities?/i, "IN"],
  [/japan|japanese universities?/i, "JP"],
  [/south korea|korean universities?/i, "KR"],
  [/singapore/i, "SG"],
  [/new zealand/i, "NZ"],
];

/** Detect all countries mentioned in the "taken at" text, honoring negations
 * like "except Australia" / "outside the United States". */
function countriesIn(text: string): string[] {
  const found: string[] = [];
  const negated = new Set<string>();
  const negationRe =
    /(except|excluding|outside|other than|not in|not including|rather than)\s+[a-z ]*?([a-z]+(?:\s+[a-z]+){0,3})/gi;
  let nm: RegExpExecArray | null;
  while ((nm = negationRe.exec(text))) {
    for (const [re, code] of RULES) {
      if (re.test(nm[2])) negated.add(code);
    }
  }
  for (const [re, code] of RULES) {
    if (!negated.has(code) && re.test(text)) found.push(code);
  }
  return found;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function specPairs(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /<p class="text-line">\s*([^<]+?):?\s*<\/p>\s*<span class="text-line-value">\s*([\s\S]*?)<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const label = m[1].replace(/&amp;/g, "&").replace(/:/g, "").trim();
    const value = m[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (label && value) map.set(label.toLowerCase(), value);
  }
  return map;
}

function metaDescription(html: string): string {
  const m = html.match(/<meta name="description" content="([^"]*)"/);
  return m ? m[1].replace(/&amp;/g, "&").trim() : "";
}

/** First external (non-wemakescholars, non-social) href = official source. */
function officialUrl(html: string): string | null {
  const seen = new Set<string>();
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);
    if (/wemakescholars\.com|facebook\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|linkedin\.com|bit\.ly|pinterest|w3\.org|schema\.org|cloudflare|bootstrapcdn|googleapis|jquery|googletagmanager\.com|google-analytics\.com|gstatic\.com|doubleclick\.net|ionicframework\.com|feedsportal|rssing|addthis\.com|sharethis\.com/.test(url)) {
      continue;
    }
    if (/\.(png|jpg|jpeg|gif|css|js|svg|ico|woff2?|pdf)$/i.test(url)) continue;
    return url;
  }
  return null;
}

function mapFunding(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("full")) return "FULLY_FUNDED";
  if (s.includes("partial")) return "PARTIAL";
  if (s.includes("tuition")) return "TUITION_WAIVER";
  if (s.includes("living") || s.includes("stipend")) return "LIVING_ALLOWANCE";
  return "PARTIAL";
}

function mapLevels(raw: string): string[] {
  const s = raw.toLowerCase();
  const out: string[] = [];
  if (s.includes("high school") || s.includes("highschool")) out.push("high-school");
  if (s.includes("bachelor") || s.includes("undergraduate") || s.includes("bachelors")) out.push("undergraduate");
  if (s.includes("master") || s.includes("masters") || s.includes("graduate")) out.push("masters");
  if (s.includes("mba")) out.push("mba");
  if (s.includes("phd") || s.includes("doctoral") || s.includes("doctorate")) out.push("phd");
  if (s.includes("postdoc")) out.push("postdoctoral");
  if (s.includes("research")) out.push("research");
  if (s.includes("short course") || s.includes("short-course")) out.push("short-course");
  if (s.includes("exchange")) out.push("exchange-program");
  return out;
}

function parseDeadline(raw: string | null): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/expired|closed|rolling|ongoing|varies|n\/a|not specified/i.test(s)) return null;
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  let m = s.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i);
  if (m && months[m[1].slice(0, 3).toLowerCase()] !== undefined) {
    return new Date(Date.UTC(Number(m[3]), months[m[1].slice(0, 3).toLowerCase()], Number(m[2]), 23, 59, 0));
  }
  m = s.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,]?\s+(\d{4})/i);
  if (m && months[m[2].slice(0, 3).toLowerCase()] !== undefined) {
    return new Date(Date.UTC(Number(m[3]), months[m[2].slice(0, 3).toLowerCase()], Number(m[1]), 23, 59, 0));
  }
  return null;
}

function takenAt(html: string): string {
  const m = html.match(
    /<p class="text-line">\s*Scholarship can be taken at:?\s*<\/p>\s*<span class="text-line-value">\s*([\s\S]*?)<\/span>/
  );
  return m
    ? m[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
    : "";
}

// ------------------------------------------------------------------ Phase 1
async function crawlListing(): Promise<string[]> {
  const existing: { pages: number; slugs: string[] } = fs.existsSync(SLUGS_FILE)
    ? JSON.parse(fs.readFileSync(SLUGS_FILE, "utf8"))
    : { pages: 0, slugs: [] };
  const slugs = new Set<string>(existing.slugs);
  let nextPage = existing.pages + 1;
  console.log(`Listing resume: ${existing.pages} pages crawled, ${slugs.size} slugs. Starting page ${nextPage}`);

  const BATCH = 8;
  let emptyBatches = 0;
  for (;;) {
    const range = Array.from({ length: BATCH }, (_, i) => nextPage + i);
    const results = await Promise.all(
      range.map(async (page) => {
        const url = `${BASE}/scholarship${page === 1 ? "" : `?page=${page}`}`;
        try {
          const html = await fetchText(url);
          const pageSlugs = [...new Set([...html.matchAll(/href="[^"]*?\/scholarship\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
          return { page, pageSlugs };
        } catch {
          return { page, pageSlugs: [] as string[] };
        }
      })
    );
    const before = slugs.size;
    for (const r of results) r.pageSlugs.forEach((s) => slugs.add(s));
    nextPage += BATCH;
    const fresh = slugs.size - before;
    if (fresh === 0) {
      emptyBatches += 1;
    } else {
      emptyBatches = 0;
    }
    fs.writeFileSync(SLUGS_FILE, JSON.stringify({ pages: nextPage - 1, slugs: [...slugs] }));
    console.log(`  pages ${nextPage - BATCH}-${nextPage - 1}: +${fresh} slugs, total ${slugs.size} | checkpoint saved`);
    // Stop when we've fetched well past the known total and seen empty batches.
    if (emptyBatches >= 2 && nextPage > 100) break;
    if (nextPage > 2500) break; // safety cap
  }
  console.log(`Listing complete: ${slugs.size} slugs through page ${nextPage - 1}.`);
  return [...slugs];
}

// ------------------------------------------------------------------ Phase 2
async function parseDetail(url: string): Promise<WmsRecord | null> {
  const html = await fetchText(url);
  const spec = specPairs(html);
  const title = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) ?? [])[1]?.trim();
  if (!title) return null;

  const provider = spec.get("provider") || "";
  const fundingRaw = spec.get("funding type") || "";
  const deadlineRaw = spec.get("deadline") || null;
  const degrees = spec.get("eligible degrees") || "";
  const description = metaDescription(html) || "";

  // Skip obvious junk: loan/insurance/promo pages that slip into the listing.
  if (/loan|insurance|refinanc|credit card|test prep/i.test(`${title} ${provider}`)) return null;

  // Destination country from the "taken at" field — only assign when exactly
  // one country is named; otherwise leave "not specified".
  const taken = takenAt(html);
  const codes = taken ? countriesIn(taken) : [];
  const countryCode = codes.length === 1 ? codes[0] : null;

  return {
    title,
    slug: slugify(title),
    provider: provider || "Not specified",
    fundingType: mapFunding(fundingRaw),
    deadline: parseDeadline(deadlineRaw),
    amount: spec.get("scholarship amount") || null,
    description: description || `${title} — scholarship listed on wemakescholars.com (${url}).`,
    officialUrl: officialUrl(html),
    sourceUrl: url,
    countryCode,
    levels: mapLevels(degrees),
  };
}

// ------------------------------------------------------------------- main
async function main() {
  const slugs = await crawlListing();
  if (LISTING_ONLY) {
    console.log(`[listing-only] ${slugs.length} slugs collected.`);
    return;
  }

  const urls = slugs.map((s) => `${BASE}/scholarship/${s}`);

  // Skip URLs already in the DB (idempotent + fast re-runs).
  const existing: string[] = [];
  for (let i = 0; i < urls.length; i += 4000) {
    const chunk = urls.slice(i, i + 4000);
    const rows = await prisma.scholarship.findMany({ where: { sourceUrl: { in: chunk } }, select: { sourceUrl: true } });
    existing.push(...rows.map((r) => r.sourceUrl).filter((u): u is string => Boolean(u)));
  }
  const seen = new Set(existing);
  const fresh = urls.filter((u) => !seen.has(u));

  // Skip URLs already parsed in a previous run (JSONL checkpoint).
  const parsed = new Set<string>();
  if (fs.existsSync(DETAILS_FILE)) {
    for (const line of fs.readFileSync(DETAILS_FILE, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        parsed.add((JSON.parse(line) as WmsRecord).sourceUrl);
      } catch {
        /* skip malformed line */
      }
    }
  }
  const toFetch = fresh.filter((u) => !parsed.has(u));
  console.log(`Total: ${urls.length} | already in DB: ${existing.length} | parsed before: ${parsed.size} | to fetch: ${toFetch.length}`);

  const targets = LIMIT > 0 ? toFetch.slice(0, LIMIT) : toFetch;
  const records: WmsRecord[] = [];
  let done = 0;
  const CONCURRENCY = 4;
  const queue = [...targets];
  let checkpointCount = 0;

  async function worker() {
    for (;;) {
      const url = queue.shift();
      if (!url) return;
      try {
        const rec = await parseDetail(url);
        if (rec) {
          records.push(rec);
          fs.appendFileSync(DETAILS_FILE, JSON.stringify(rec) + "\n");
          checkpointCount += 1;
          done += 1;
          if (done % 25 === 0 || done === targets.length) {
            console.log(`  [${done}/${targets.length}] ${rec.countryCode ?? "??"} ${rec.title.slice(0, 50)} | ${rec.fundingType} | dl=${rec.deadline?.toISOString().slice(0, 10) ?? "-"} | src=${rec.officialUrl ? "yes" : "none"}`);
          }
        } else {
          done += 1;
        }
      } catch (e) {
        done += 1;
        if (done % 25 === 0) console.log(`  [${done}/${targets.length}] (fetch errors so far: ${e instanceof Error ? e.message : e})`);
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Parsed ${records.length} records (checkpoint: ${checkpointCount} lines appended).`);

  if (DRY_RUN) {
    const byCountry = new Map<string, number>();
    for (const r of records) byCountry.set(r.countryCode ?? "none", (byCountry.get(r.countryCode ?? "none") ?? 0) + 1);
    console.log("[dry-run] Would insert (non-CN):");
    for (const [c, n] of [...byCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${c}: ${n}`);
    return;
  }

  // Insert as PENDING, excluding China-destination records (already covered
  // by the CUCAS/cscouncil/campuschina imports — avoids cross-source dupes).
  const toInsert = records.filter((r) => r.countryCode !== "CN");
  console.log(`Inserting ${toInsert.length} records (excluding ${records.length - toInsert.length} China).`);
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500);
    const result = await prisma.scholarship.createMany({
      data: chunk.map((r) => ({
        title: r.title,
        slug: r.slug,
        description: r.description,
        provider: r.provider,
        providerType: "ORGANIZATION",
        countryCode: r.countryCode,
        fundingType: r.fundingType,
        amount: r.amount,
        deadline: r.deadline,
        deadlineTimezone: r.deadline ? "UTC" : null,
        officialUrl: r.officialUrl,
        sourceUrl: r.sourceUrl,
        studyLevels: JSON.stringify(r.levels),
        status: "PENDING",
        verificationStatus: "UNVERIFIED",
        recordType: "SCHOLARSHIP",
        submittedNote: `Imported from wemakescholars.com global catalogue on ${new Date().toISOString().slice(0, 10)}`,
      })),
      skipDuplicates: true,
    });
    inserted += result.count;
    console.log(`  inserted chunk ${i / 500 + 1}: ${result.count} (total ${inserted})`);
  }
  console.log(`Inserted: ${inserted}`);
}

// --insert-only: read the full JSONL checkpoint and insert every record that
// isn't already in the DB (idempotent, skips China + existing sourceUrls).
async function insertOnly() {
  const lines = fs.readFileSync(DETAILS_FILE, "utf8").split("\n").filter((l) => l.trim());
  const records: WmsRecord[] = [];
  for (const line of lines) {
    try {
      records.push(JSON.parse(line) as WmsRecord);
    } catch {
      /* skip malformed */
    }
  }
  console.log(`JSONL records: ${records.length}`);

  const existing = await prisma.scholarship.findMany({
    where: { sourceUrl: { not: null } },
    select: { sourceUrl: true },
  });
  const existingSet = new Set(existing.map((e) => e.sourceUrl as string));
  const toInsert = records.filter((r) => r.countryCode !== "CN" && !existingSet.has(r.sourceUrl));
  console.log(`To insert (non-CN, not already in DB): ${toInsert.length}`);
  if (DRY_RUN) {
    const byCountry = new Map<string, number>();
    for (const r of toInsert) byCountry.set(r.countryCode ?? "none", (byCountry.get(r.countryCode ?? "none") ?? 0) + 1);
    for (const [c, n] of [...byCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${c}: ${n}`);
    return;
  }
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500);
    const result = await prisma.scholarship.createMany({
      data: chunk.map((r) => ({
        title: r.title,
        slug: r.slug,
        description: r.description,
        provider: r.provider,
        providerType: "ORGANIZATION",
        countryCode: r.countryCode,
        fundingType: r.fundingType,
        amount: r.amount,
        deadline: r.deadline,
        deadlineTimezone: r.deadline ? "UTC" : null,
        officialUrl: r.officialUrl,
        sourceUrl: r.sourceUrl,
        studyLevels: JSON.stringify(r.levels),
        status: "PENDING",
        verificationStatus: "UNVERIFIED",
        recordType: "SCHOLARSHIP",
        submittedNote: `Imported from wemakescholars.com global catalogue on ${new Date().toISOString().slice(0, 10)}`,
      })),
      skipDuplicates: true,
    });
    inserted += result.count;
    console.log(`  inserted chunk ${i / 500 + 1}: ${result.count} (total ${inserted})`);
  }
  console.log(`Inserted: ${inserted}`);
}

if (INSERT_ONLY) {
  insertOnly()
    .catch((err) => {
      console.error("Insert failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
} else {
  main()
    .catch((err) => {
      console.error("Import failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
