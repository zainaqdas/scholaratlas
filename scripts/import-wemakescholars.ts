import { createManySkipDuplicates } from "./lib/insert-many";
// ---------------------------------------------------------------------------
// wemakescholars.com China scholarship importer.
//
// wemakescholars is a structured scholarship aggregator (robots-permissive,
// static HTML, no WAF). The "Government of China" provider page lists ~20-40
// real China scholarships (Beijing/Chongqing/Guangdong/Nanjing provincial
// programs, CSC bilateral/AUN/EU/WMO/Silk Road programs, MOFCOM, etc.). Each
// detail page carries structured fields (Deadline, Provider, Funding Type,
// University, Country) plus a link to the official source where one exists.
//
// Imported records land as PENDING/UNVERIFIED — nothing public until an admin
// approves them. Dedupes by source URL (idempotent).
//
// Usage:
//   npm run import:wemakescholars                  # full run
//   npm run import:wemakescholars -- --dry-run     # report only
//   npm run import:wemakescholars -- --limit 5     # cap fetches/inserts
// ---------------------------------------------------------------------------

import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/utils";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = Number(args[args.indexOf("--limit") + 1] ?? 0) || 0;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const LISTING_URL = "https://www.wemakescholars.com/other/government-of-china/scholarships";

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
    if (/wemakescholars\.com|facebook\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|linkedin\.com|bit\.ly|pinterest|w3\.org|schema\.org|cloudflare|bootstrapcdn|googleapis|jquery|googletagmanager\.com|google-analytics\.com|gstatic\.com|doubleclick\.net/.test(url)) {
      continue;
    }
    if (/\.(png|jpg|jpeg|gif|css|js|svg|ico|woff2?)$/i.test(url)) continue;
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

function parseDeadline(raw: string | null): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/expired|closed|rolling|ongoing|varies|n\/a/i.test(s)) return null;
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

async function parseDetail(url: string): Promise<WmsRecord | null> {
  const html = await fetchText(url);
  const spec = specPairs(html);
  const title = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) ?? [])[1]?.trim();
  if (!title) return null;

  const provider = spec.get("provider") || "Government of China";
  const fundingRaw = spec.get("funding type") || "";
  const deadlineRaw = spec.get("deadline") || null;
  const takenAt = spec.get("scholarship can be taken at") || "";
  const description = metaDescription(html) || "";

  // Keep only China scholarships. The listing page mixes a "related
  // scholarships" sidebar (non-China universities), so we require a China
  // signal in the provider / host-country / title.
  const isChina = /china|beijing|shanghai|guangdong|jiangsu|tianjin|chongqing|nanjing|zhejiang|sichuan|mofcom|csc|silk|wmo|aun|eu window|marine|belt|universities in china|in china/i.test(
    `${provider} ${takenAt} ${title}`
  );
  if (!isChina) return null;

  return {
    title,
    slug: slugify(title),
    provider,
    fundingType: mapFunding(fundingRaw),
    deadline: parseDeadline(deadlineRaw),
    amount: spec.get("scholarship amount") || null,
    description: description || `China scholarship listed on wemakescholars.com (${url}).`,
    officialUrl: officialUrl(html),
    sourceUrl: url,
  };
}

async function main() {
  console.log(`Fetching listing: ${LISTING_URL}`);
  const listingHtml = await fetchText(LISTING_URL);
  const slugs = [...new Set([...listingHtml.matchAll(/href="[^"]*?\/scholarship\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
  // Keep China-relevant scholarships (listed under the Government of China page).
  const chinaish = slugs.filter((s) =>
    /china|government|beijing|shanghai|guangdong|jiangsu|tianjin|chongqing|nanjing|zhejiang|sichuan|mofcom|csc|wmo|silk|aun|marine|confucius|belt|university/i.test(s)
  );
  console.log(`Found ${slugs.length} slugs on listing; ${chinaish.length} China-relevant.`);

  const targets = LIMIT > 0 ? chinaish.slice(0, LIMIT) : chinaish;
  const records: WmsRecord[] = [];
  for (const slug of targets) {
    const url = `https://www.wemakescholars.com/scholarship/${slug}`;
    try {
      const rec = await parseDetail(url);
      if (rec) {
        records.push(rec);
        console.log(`  ${rec.title} | ${rec.provider} | ${rec.fundingType} | dl=${rec.deadline?.toISOString().slice(0, 10) ?? "-"} | src=${rec.officialUrl ?? "none"}`);
      }
    } catch (e) {
      console.error(`  failed ${url}: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`Parsed ${records.length} records.`);

  if (DRY_RUN) {
    console.log(`[dry-run] Would insert ${records.length} new records.`);
    return;
  }

  const existing = await prisma.scholarship.findMany({
    where: { sourceUrl: { in: records.map((r) => r.sourceUrl) } },
    select: { sourceUrl: true },
  });
  const seen = new Set(existing.map((e) => e.sourceUrl));
  const fresh = records.filter((r) => !seen.has(r.sourceUrl));

  let inserted = 0;
  if (fresh.length) {
    inserted = await createManySkipDuplicates(
      prisma.scholarship,
      fresh.map((r) => ({
        title: r.title,
        slug: r.slug,
        description: r.description,
        provider: r.provider,
        providerType: "GOVERNMENT",
        countryCode: "CN",
        fundingType: r.fundingType,
        amount: r.amount,
        deadline: r.deadline,
        deadlineTimezone: r.deadline ? "UTC" : null,
        officialUrl: r.officialUrl,
        sourceUrl: r.sourceUrl,
        status: "PENDING",
        verificationStatus: "UNVERIFIED",
        recordType: "SCHOLARSHIP",
        submittedNote: `Imported from wemakescholars.com on ${new Date().toISOString().slice(0, 10)}`,
      }))
    );
  }
  console.log(`New: ${fresh.length} | Already imported: ${records.length - fresh.length} | Inserted: ${inserted}`);
}

main()
  .catch((err) => {
    console.error("Import failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
