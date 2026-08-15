/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// EURAXESS RSS importer.
//
// Fetches the public EURAXESS job feed (https://euraxess.ec.europa.eu/job-feed),
// normalizes each entry into the ScholarAtlas model, dedupes against existing
// records by source URL, and inserts new listings as PENDING for admin review.
//
// The feed publishes the most recent jobs (20 per page; the server currently
// ignores pagination params). Running this on a schedule grows the catalogue
// incrementally with new postings while staying on the robots.txt-allowed path
// (the feed and sitemap are not disallowed).
//
// Usage:
//   npm run import:euraxess                 # full run
//   npm run import:euraxess -- --limit 10   # cap inserts (testing)
//   npm run import:euraxess -- --dry-run    # fetch + report, no writes
// ---------------------------------------------------------------------------

import { XMLParser } from "fast-xml-parser";
import { prisma } from "../src/lib/prisma";

const FEED_URL =
  process.env.EURAXESS_FEED_URL ?? "https://euraxess.ec.europa.eu/job-feed";
const USER_AGENT =
  "ScholarAtlas-Importer/1.0 (metadata catalog; contact hello@scholaratlas.dev)";
const REQUEST_TIMEOUT_MS = 20_000;
const PAGE_DELAY_MS = 600; // politeness between page fetches

const DESCRIPTION_MAX = 3000;
const TITLE_MAX = 200;

// --- CLI flags --------------------------------------------------------------

const args = process.argv.slice(2);
const flagValue = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const LIMIT = Number(flagValue("limit") ?? 0) || 0; // 0 = no limit
const PAGES = Number(flagValue("pages") ?? 1) || 1;
const DRY_RUN = args.includes("--dry-run");

// --- Helpers ----------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, " ");
}

function cleanText(s: string | undefined | null, max = 4000): string {
  if (!s) return "";
  return decodeEntities(stripHtml(s)).replace(/\s+/g, " ").trim().slice(0, max);
}

// RFC 822 dates in the feed use 2-digit years ("Fri, 31 Jul 26 23:24:34 +0200").
function parseRfc822(s: string | undefined | null): Date | null {
  if (!s) return null;
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  // Manual fallback: "Fri, 31 Jul 26 23:24:34 +0200"
  const m = s.match(
    /^[A-Za-z]{3},\s*(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s*(Z|[+-]\d{4})?$/
  );
  if (!m) return null;
  const [, day, mon, year, hh, mm, ss, tz] = m;
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  if (months[mon] === undefined) return null;
  let fullYear = Number(year);
  if (fullYear < 100) fullYear += fullYear >= 70 ? 1900 : 2000;
  const d = new Date(
    Date.UTC(fullYear, months[mon], Number(day), Number(hh), Number(mm), Number(ss ?? 0))
  );
  if (tz && tz !== "Z") {
    const off = Number(tz.slice(1, 3)) * 60 + Number(tz.slice(3, 5));
    d.setUTCMinutes(d.getUTCMinutes() + (tz.startsWith("-") ? off : -off));
  }
  return Number.isNaN(d.getTime()) ? null : d;
}

function slugify(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics (é → e)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  return base || "euraxess-job";
}

function titleToLevels(title: string): string[] {
  const t = title.toLowerCase();
  if (/postdoc|post-doc|post doctoral/.test(t)) return ["postdoctoral"];
  if (/phd|doctorate|doctoral|d\.phil/.test(t)) return ["phd"];
  if (/master'?s|msc|ma degree|graduate degree/.test(t)) return ["masters"];
  if (/bachelor'?s|undergraduate|bsc|beng/.test(t)) return ["undergraduate"];
  if (/researcher|research fellow|scientist|professor|chair|lecturer|senior researcher/.test(t))
    return ["research"];
  return [];
}

function providerTypeFrom(name: string): string | undefined {
  const n = name.toLowerCase();
  if (/universit|polytechnic|college/.test(n)) return "UNIVERSITY";
  if (/gmbh|ltd|llc|s\.?a\.?|inc\.?|corporation/.test(n)) return "PRIVATE";
  if (/ministry|government|agency|national center|national centre/.test(n)) return "GOVERNMENT";
  return undefined; // leave the model default; admin can adjust on review
}

interface FeedItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  "dc:creator"?: string;
  guid?: { "#text"?: string | number } | string | number;
}

async function fetchFeedPage(page: number): Promise<FeedItem[]> {
  const url = page <= 1 ? FEED_URL : `${FEED_URL}?page=${page}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Feed returned HTTP ${res.status} for ${url}`);
  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
    // allow the dc: prefix to survive parsing
    removeNSPrefix: false,
  });
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: FeedItem | FeedItem[] } } };
  const items = doc.rss?.channel?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

function normalize(item: FeedItem, importedAt: Date) {
  const title = cleanText(item.title, TITLE_MAX);
  const link = cleanText(item.link, 500);
  const rawGuid = typeof item.guid === "object" ? item.guid?.["#text"] : item.guid;
  const guid = String(rawGuid ?? "").trim();
  const provider = cleanText(item["dc:creator"], 200).replace(/\s+via\s+.+$/i, "").trim();
  const description = cleanText(item.description, DESCRIPTION_MAX) || title;
  const publishedAt = parseRfc822(item.pubDate);
  const levels = titleToLevels(title);

  return {
    title,
    slug: slugify(title),
    officialUrl: link,
    sourceUrl: link,
    provider: provider || "EURAXESS",
    description,
    studyLevels: JSON.stringify(levels),
    status: "PENDING",
    verificationStatus: "UNVERIFIED",
    submittedNote: `Imported from EURAXESS RSS feed (job ${guid}) on ${importedAt.toISOString().slice(0, 10)}`,
    createdAt: publishedAt ?? importedAt,
    ...(providerTypeFrom(provider) ? { providerType: providerTypeFrom(provider) } : {}),
  };
}

// --- Main -------------------------------------------------------------------

async function main() {
  const importedAt = new Date();
  const all: ReturnType<typeof normalize>[] = [];
  let fetched = 0;

  for (let page = 1; page <= PAGES; page++) {
    const items = await fetchFeedPage(page);
    fetched += items.length;
    for (const item of items) {
      const normalized = normalize(item, importedAt);
      if (normalized.title && normalized.officialUrl) all.push(normalized);
    }
    if (page < PAGES) await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
  }

  console.log(`Fetched ${fetched} feed entries (${all.length} usable).`);

  if (DRY_RUN) {
    console.log(`[dry-run] Would insert ${all.length} new records.`);
    for (const r of all.slice(0, LIMIT || 5)) {
      console.log(`  - ${r.title} | ${r.provider} | ${r.sourceUrl}`);
    }
    return;
  }

  // Dedupe against existing records by source URL
  const urls = all.map((r) => r.officialUrl);
  const existing = await prisma.scholarship.findMany({
    where: { sourceUrl: { in: urls } },
    select: { sourceUrl: true },
  });
  const seen = new Set(existing.map((e) => e.sourceUrl));
  const fresh = all.filter((r) => !seen.has(r.officialUrl));
  const skipped = all.length - fresh.length;

  // Report possible duplicates (same title + provider, different URL) for awareness
  const existingTitles = await prisma.scholarship.findMany({
    where: { title: { in: fresh.map((r) => r.title) } },
    select: { title: true, provider: true },
  });
  const nearDup = new Set(
    existingTitles.map((e) => `${e.title.toLowerCase()}|${e.provider.toLowerCase()}`)
  );
  const possibleDupes = fresh.filter((r) =>
    nearDup.has(`${r.title.toLowerCase()}|${r.provider.toLowerCase()}`)
  );

  let toInsert = fresh;
  if (LIMIT > 0) toInsert = fresh.slice(0, LIMIT);

  // Ensure unique slugs: suffix collisions with the EURAXESS job id
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
    if (used.has(slug)) {
      slug = `${slug}-${r.sourceUrl.split("/").pop() ?? "x"}`;
    }
    used.add(slug);
    return { ...r, slug };
  });

  let inserted = 0;
  if (finalData.length) {
    const result = await prisma.scholarship.createMany({
      data: finalData as never[],
      skipDuplicates: true,
    });
    inserted = result.count;
  }

  console.log(`New: ${toInsert.length} | Skipped (already imported): ${skipped} | Inserted: ${inserted}`);
  console.log(`Possible duplicates flagged for review: ${possibleDupes.length}`);
  for (const d of possibleDupes.slice(0, 10)) {
    console.log(`  ⚠ ${d.title} — ${d.provider} (${d.sourceUrl})`);
  }
  if (possibleDupes.length > 10) {
    console.log(`  … and ${possibleDupes.length - 10} more`);
  }
  console.log(
    inserted > 0
      ? `Imported records are PENDING — review them at /admin.`
      : "Nothing new to import."
  );
}

main()
  .catch((err) => {
    console.error("Import failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
