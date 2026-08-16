/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// wemakescholars.com US/UK/EU scholarship importer.
//
// wemakescholars is a structured scholarship aggregator (robots-permissive,
// static HTML, no WAF). Its country landing pages list all scholarships for
// studying in a destination country:
//
//   /scholarships-to-study-in-{country}-for-international-students?page=N
//
// Verified counts (2026-08-16): United States 326, UK 195, Germany 186,
// Canada 154, Australia 151, Ireland 130, Netherlands 129, Italy 129,
// Sweden 126, Finland 123, Spain 124, Switzerland 114, France 142, Norway ~0.
//
// Each detail page carries structured fields (Deadline, Provider, Funding
// Type, Eligible Degrees, Eligible Nationalities, Scholarship can be taken
// at) plus a link to the official source where one exists.
//
// Imported records land as PENDING/UNVERIFIED — nothing public until an admin
// approves them. Dedupes by source URL (idempotent).
//
// Usage:
//   npm run import:wms-global                  # full run (all countries)
//   npm run import:wms-global -- --dry-run     # report only
//   npm run import:wms-global -- --limit 30    # cap detail fetches
//   npm run import:wms-global -- --countries us,gb,de
// ---------------------------------------------------------------------------

import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/utils";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = Number(args[args.indexOf("--limit") + 1] ?? 0) || 0;
const flagValue = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// destination-country slug on wemakescholars -> ISO country code
const COUNTRIES: Record<string, string> = {
  "united-states": "US",
  "united-kingdom": "GB",
  germany: "DE",
  france: "FR",
  canada: "CA",
  australia: "AU",
  ireland: "IE",
  netherlands: "NL",
  sweden: "SE",
  norway: "NO",
  finland: "FI",
  switzerland: "CH",
  italy: "IT",
  spain: "ES",
};

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
  countryCode: string;
  levels: string[];
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Extract "Label:" / value pairs from the detail spec block. */
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
  const m = s.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i);
  if (m) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const month = months[m[1].slice(0, 3).toLowerCase()];
    const day = Number(m[2]);
    const year = Number(m[3]);
    if (month !== undefined && !Number.isNaN(day) && !Number.isNaN(year)) {
      return new Date(Date.UTC(year, month, day, 23, 59, 0));
    }
  }
  const mm = s.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,]?\s+(\d{4})/i);
  if (mm) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    return new Date(Date.UTC(Number(mm[3]), months[mm[2].slice(0, 3).toLowerCase()], Number(mm[1]), 23, 59, 0));
  }
  return null;
}

/** Collect all scholarship slugs for a country across its paginated listing. */
async function listingSlugs(countrySlug: string): Promise<string[]> {
  const slugs = new Set<string>();
  let page = 1;
  for (;;) {
    const url = `${BASE}/scholarships-to-study-in-${countrySlug}-for-international-students${page === 1 ? "" : `?page=${page}`}`;
    const html = await fetchText(url);
    const pageSlugs = [...new Set([...html.matchAll(/href="[^"]*?\/scholarship\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
    const before = slugs.size;
    pageSlugs.forEach((s) => slugs.add(s));
    const totalMatch = html.match(/var total_page=(\d+)/);
    if (pageSlugs.length === 0 || slugs.size === before || (totalMatch && page >= Math.ceil(Number(totalMatch[1]) / 34) + 1)) {
      break;
    }
    page += 1;
    await new Promise((r) => setTimeout(r, 250));
  }
  return [...slugs];
}

async function parseDetail(url: string, countryCode: string): Promise<WmsRecord | null> {
  const html = await fetchText(url);
  const spec = specPairs(html);
  const title = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) ?? [])[1]?.trim();
  if (!title) return null;

  const provider = spec.get("provider") || "";
  const fundingRaw = spec.get("funding type") || "";
  const deadlineRaw = spec.get("deadline") || null;
  const degrees = spec.get("eligible degrees") || "";
  const takenAt = spec.get("scholarship can be taken at") || "";
  const description = metaDescription(html) || "";

  // Skip obvious junk: loan/insurance/promo pages that slip into the listing.
  if (/loan|insurance|refinanc|credit card|test prep/i.test(`${title} ${provider}`)) return null;

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

async function main() {
  const countriesArg = flagValue("countries");
  // Accept either the wemakescholars slug ("united-states") or the ISO code
  // ("us") in the --countries flag.
  const SLUG_BY_CODE: Record<string, string> = Object.fromEntries(
    Object.entries(COUNTRIES).map(([slug, code]) => [code.toLowerCase(), slug])
  );
  const targets = countriesArg
    ? countriesArg.split(",").map((c) => c.trim().toLowerCase()).map((c) => SLUG_BY_CODE[c] ?? c)
    : Object.keys(COUNTRIES);

  const urls: { url: string; countryCode: string }[] = [];
  for (const slug of targets) {
    const code = COUNTRIES[slug];
    if (!code) {
      console.log(`SKIP unknown country slug: ${slug}`);
      continue;
    }
    try {
      const slugs = await listingSlugs(slug);
      console.log(`${code}: ${slugs.length} scholarships`);
      slugs.forEach((s) => urls.push({ url: `${BASE}/scholarship/${s}`, countryCode: code }));
    } catch (e) {
      console.error(`  listing failed ${slug}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`Total detail URLs: ${urls.length}`);

  // Skip URLs already in the DB before fetching details (idempotent + fast re-runs).
  const existing = await prisma.scholarship.findMany({
    where: { sourceUrl: { in: urls.map((u) => u.url) } },
    select: { sourceUrl: true },
  });
  const seen = new Set(existing.map((e) => e.sourceUrl));
  const freshUrls = urls.filter((u) => !seen.has(u.url));
  console.log(`Already imported: ${urls.length - freshUrls.length} | To fetch: ${freshUrls.length}`);

  const targets2 = LIMIT > 0 ? freshUrls.slice(0, LIMIT) : freshUrls;
  const records: WmsRecord[] = [];
  let done = 0;
  const CONCURRENCY = 6;
  const queue = [...targets2];
  async function worker() {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      try {
        const rec = await parseDetail(item.url, item.countryCode);
        if (rec) {
          records.push(rec);
          console.log(
            `  [${++done}/${targets2.length}] ${rec.countryCode} ${rec.title.slice(0, 55)} | ${rec.fundingType} | dl=${rec.deadline?.toISOString().slice(0, 10) ?? "-"} | src=${rec.officialUrl ? "yes" : "none"}`
          );
        }
      } catch (e) {
        console.error(`  failed ${item.url}: ${e instanceof Error ? e.message : e}`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Parsed ${records.length} records.`);

  if (DRY_RUN) {
    console.log(`[dry-run] Would insert ${records.length} new records.`);
    return;
  }

  let inserted = 0;
  if (records.length) {
    const result = await prisma.scholarship.createMany({
      data: records.map((r) => ({
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
        submittedNote: `Imported from wemakescholars.com on ${new Date().toISOString().slice(0, 10)}`,
      })),
      skipDuplicates: true,
    });
    inserted = result.count;
  }
  console.log(`Inserted: ${inserted}`);
}

main()
  .catch((err) => {
    console.error("Import failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
