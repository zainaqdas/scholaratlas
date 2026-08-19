import { createManySkipDuplicates } from "./lib/insert-many";
import { renewalDecision, applyRenewals } from "./lib/insert-or-renew";
/* Import the scholars4dev.com scholarship database (583 posts, ~530 real
 * scholarship listings) from data/s4d/scholarships.jsonl (crawled by
 * scripts/crawl-scholars4dev.py).
 *
 * Maps each post to the Scholarship schema:
 *   title          -> title
 *   briefDescription + eligibility + value + hostInstitution + targetGroup -> description
 *   country        -> countryCode (only when a single country is named)
 *   degreeLevel    -> studyLevels
 *   fields         -> fields (keyword match against app field slugs)
 *   value          -> amount + currency + benefits (parsed)
 *   deadline       -> deadline (parsed when a concrete date)
 *   website        -> officialUrl (external provider site)
 *   scholars4dev URL -> sourceUrl
 *
 * Records are inserted as PENDING (pending-review flow, same as the EURAXESS
 * importer) so an admin reviews them before they appear in the live catalogue.
 * Dedupe by sourceUrl and by (title + provider) fingerprint.
 *
 * Usage:
 *   npx tsx scripts/import-scholars4dev.ts --dry-run
 *   npx tsx scripts/import-scholars4dev.ts
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

// ---------------------------------------------------------------------------
// Country mapping (exact-match first, then keyword). Only single-country
// values get a countryCode; multi-country / "any country" stay null so we
// never misrepresent a destination.
// ---------------------------------------------------------------------------
const COUNTRY_EXACT: Record<string, string> = {
  "UK": "GB",
  "London, UK": "GB",
  "London": "GB",
  "Wales": "GB",
  "USA": "US",
  "Kentucky, USA": "US",
  "Hawaii, USA": "US",
  "Australia": "AU",
  "Netherlands": "NL",
  "Canada": "CA",
  "Germany": "DE",
  "Berlin, Germany": "DE",
  "Sweden": "SE",
  "New Zealand": "NZ",
  "Switzerland": "CH",
  "Geneva, Switzerland": "CH",
  "Italy": "IT",
  "Japan": "JP",
  "Belgium": "BE",
  "France": "FR",
  "Paris, France": "FR",
  "Denmark": "DK",
  "South Africa": "ZA",
  "Finland": "FI",
  "Singapore": "SG",
  "Turkey": "TR",
  "Norway": "NO",
  "Korea": "KR",
  "China": "CN",
  "Taiwan": "TW",
  "Malaysia": "MY",
  "Spain": "ES",
  "Budapest, Hungary": "HU",
  "Israel": "IL",
  "Greece": "GR",
};

const COUNTRY_KEYWORD: [RegExp, string][] = [
  [/united kingdom|\buk\b|britain|england|scotland|wales/i, "GB"],
  [/united states|\busa\b|\bu\.?s\.?a\.?\b|\bus\b/i, "US"],
  [/australia/i, "AU"],
  [/netherlands|holland/i, "NL"],
  [/canada/i, "CA"],
  [/germany/i, "DE"],
  [/sweden/i, "SE"],
  [/new zealand/i, "NZ"],
  [/switzerland/i, "CH"],
  [/italy/i, "IT"],
  [/japan/i, "JP"],
  [/belgium/i, "BE"],
  [/france/i, "FR"],
  [/denmark/i, "DK"],
  [/south africa/i, "ZA"],
  [/finland/i, "FI"],
  [/singapore/i, "SG"],
  [/turkey/i, "TR"],
  [/norway/i, "NO"],
  [/korea/i, "KR"],
  [/china/i, "CN"],
  [/taiwan/i, "TW"],
  [/malaysia/i, "MY"],
  [/spain/i, "ES"],
  [/hungary/i, "HU"],
  [/israel/i, "IL"],
  [/greece/i, "GR"],
];

// Multi-country / global values that must NOT resolve to a single code.
const AMBIGUOUS = new Set([
  "?", "", "any Country", "Any Country", "any country", "Any country",
  "Any Country (online)", "any Country (online)", "any country (online)",
  "Any Country*", "various countries", "multiple countries",
  "European Countries", "Countries outside the U.S.", "Latin America/Carribean",
]);

function countryCode(raw: string | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v || AMBIGUOUS.has(v)) return null;
  if (COUNTRY_EXACT[v]) return COUNTRY_EXACT[v];
  // Multi-country values ("France/Singapore", "Germany, Spain, UK", "Turkey and
  // Germany") are ambiguous — only accept a single match.
  const hits = COUNTRY_KEYWORD.filter(([re]) => re.test(v)).map(([, c]) => c);
  return hits.length === 1 ? hits[0] : null;
}

// ---------------------------------------------------------------------------
// Degree level -> studyLevels (app uses human-readable StudyLevel names)
// ---------------------------------------------------------------------------
const LEVEL_RULES: [RegExp, string[]][] = [
  [/ph\.?d|doctor|doctoral/i, ["PhD"]],
  [/postgrad|master/i, ["Master's"]],
  [/mba|mphil/i, ["MBA"]],
  [/bachelor|undergraduate|\bbs\b|\bms\b/i, ["Undergraduate"]],
  [/associate/i, ["Undergraduate"]],
  [/training|short course/i, ["Short Course"]],
];

function studyLevels(degreeLevel: string | undefined): string[] {
  const d = (degreeLevel ?? "").trim();
  if (!d || d === "?") return [];
  const levels = new Set<string>();
  for (const [re, ls] of LEVEL_RULES) {
    if (re.test(d)) for (const l of ls) levels.add(l);
  }
  // "Masters/PhD" style combinations are already covered by the ordering
  // above (both rules fire); nothing else needed.
  return [...levels];
}

// ---------------------------------------------------------------------------
// Fields of study (app field slugs)
// ---------------------------------------------------------------------------
const FIELD_RULES: [RegExp, string][] = [
  [/\bcomputer science|computing|informatics|software engineering|information technology/i, "computer-science"],
  [/artificial intelligence|\bai\b|machine learning|deep learning/i, "artificial-intelligence"],
  [/data science|data analytics|big data/i, "data-science"],
  [/cyber|information security|network security/i, "cybersecurity"],
  [/engineering(?! management)/i, "engineering"],
  [/medicine|medical|health sciences|clinical/i, "medicine"],
  [/public health|epidemiology/i, "public-health"],
  [/nursing/i, "nursing"],
  [/biotech/i, "biotechnology"],
  [/\bbiology|life sciences|biomedical|molecular/i, "biology"],
  [/chemistry|biochemistry/i, "chemistry"],
  [/\bphysics|astrophysics|quantum/i, "physics"],
  [/mathematics|math(?!ematics and)/i, "mathematics"],
  [/natural sciences|environmental science|ecology|earth sciences|geology|ocean/i, "natural-sciences"],
  [/environmental/i, "environmental-science"],
  [/\bbusiness|management|entrepreneurship|commerce/i, "business"],
  [/\bfinance|banking|financial/i, "finance"],
  [/\beconomics|econometric/i, "economics"],
  [/\bmarketing/i, "marketing"],
  [/\baccounting|accountancy/i, "accounting"],
  [/\blaw|legal/i, "law"],
  [/political science|politics|government/i, "political-science"],
  [/international relations|international development|global affairs/i, "international-relations"],
  [/social sciences|sociology|anthropology|criminology|gender studies|development studies/i, "social-sciences"],
  [/\bpsychology|psychiatry|neuroscience/i, "psychology"],
  [/\beducation|teaching|pedagogy/i, "education"],
  [/\bagriculture|agri|food science|veterinary|forestry/i, "agriculture"],
  [/\barchitecture|urban planning|urban design/i, "architecture"],
  [/\barts|fine arts|humanities|literature|creative writing|film studies/i, "arts"],
  [/\bdesign|fashion|graphic design|industrial design/i, "design"],
  [/\bmedia|journalism|communication|broadcast/i, "media"],
  [/\bmusic/i, "music"],
  [/\bhistory/i, "history"],
  [/\bphilosophy/i, "philosophy"],
  [/\blinguistics|language/i, "linguistics"],
  [/\btourism|hospitality/i, "tourism"],
  [/\bsports|physical education|kinesiology|exercise/i, "sports-science"],
];

function fieldsOf(raw: string | undefined, extraText = ""): string[] {
  const haystack = `${raw ?? ""} ${extraText}`.toLowerCase();
  const found = new Set<string>();
  for (const [re, slug] of FIELD_RULES) {
    if (re.test(haystack)) found.add(slug);
  }
  return [...found];
}

// ---------------------------------------------------------------------------
// Funding parsing (value/inclusions text)
// ---------------------------------------------------------------------------
function parseFunding(value: string | undefined): {
  amount: string | null; currency: string | null; benefits: string[];
  fundingType: string;
} {
  const benefits: string[] = [];
  const t = (value ?? "").toLowerCase();
  let amount: string | null = null;
  let currency: string | null = null;
  const m = (value ?? "").match(
    /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(eur|euro|€|usd|us\$|\$|gbp|£|aud|a\$|cad|c\$|nzd|chf|sek|jpy|¥)/i
  );
  if (m) {
    amount = m[0].trim();
    const code = m[2].toUpperCase();
    if (code.includes("EUR") || code.includes("€") || code.includes("EURO")) currency = "EUR";
    else if (code.includes("GBP") || code.includes("£")) currency = "GBP";
    else if (code.includes("USD") || code === "$" || code.includes("US$")) currency = "USD";
    else if (code.includes("AUD") || code.includes("A$")) currency = "AUD";
    else if (code.includes("CAD") || code.includes("C$")) currency = "CAD";
    else if (code.includes("NZD")) currency = "NZD";
    else if (code.includes("CHF")) currency = "CHF";
    else if (code.includes("SEK")) currency = "SEK";
    else if (code.includes("JPY") || code.includes("¥")) currency = "JPY";
  }
  if (/\btuition|full fee|fee waiver|course fees?/.test(t)) benefits.push("tuition");
  if (/\bstipend|monthly (allowance|stipend)|maintenance (allowance|grant)/.test(t)) benefits.push("stipend");
  if (/\baccommodation|housing|dormitory|room and board/.test(t)) benefits.push("accommodation");
  if (/\binsurance|medical cover/.test(t)) benefits.push("insurance");
  if (/\btravel (?:allowance|grant)|airfare|flight/.test(t)) benefits.push("airfare");
  if (/\bvisa/.test(t)) benefits.push("visa");

  // Funding type: full coverage phrases -> FULLY_FUNDED; plus stipend -> STIPEND.
  const fullyFunded =
    /fully funded|full tuition|full funding|full cost|covers all|all (tuition|expenses)|complete funding/i.test(t);
  const hasStipend = /stipend|monthly (allowance|salary)|living (allowance|expenses|cost)/i.test(t);
  const fundingType = hasStipend && fullyFunded
    ? "FULLY_FUNDED_STIPEND"
    : fullyFunded
      ? "FULLY_FUNDED"
      : benefits.includes("tuition")
        ? "TUITION_WAIVER"
        : "PARTIAL";
  return { amount, currency, benefits, fundingType };
}

// ---------------------------------------------------------------------------
// Deadline parsing (only concrete dates)
// ---------------------------------------------------------------------------
function parseDeadline(text: string | undefined): Date | null {
  if (!text) return null;
  const t = text.trim();
  if (!/\d{4}/.test(t)) return null; // "admissions (annual)", "rolling" etc.
  const m = t.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{4})|([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})|(\d{4})-(\d{2})-(\d{2})/i
  );
  if (!m) return null;
  const day = m[1] || m[5];
  const month = m[2] || m[4];
  const year = m[3] || m[6];
  if (year && month && day) {
    const d = new Date(`${month} ${day}, ${year}`);
    return isNaN(d.getTime()) ? null : d;
  }
  if (m[7] && m[8] && m[9]) {
    const d = new Date(Number(m[7]), Number(m[8]) - 1, Number(m[9]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

// List/roundup posts and tips/FAQ posts are not single scholarship records.
function isListPost(title: string): boolean {
  return /^(top|10\+|25|20|30|15\+|12|7\+|9\+|5\+|list of|the best|best)\s/i.test(title.trim());
}
function isTipPost(title: string): boolean {
  return /^(scholarship tip|scholarship (application )?questions|how to|why |what )/i.test(title.trim());
}

async function main() {
  const rows: any[] = [];
  for (const line of readFileSync("data/s4d/scholarships.jsonl", "utf8").split("\n")) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line));
  }
  console.log(`scholars4dev records: ${rows.length}`);

  const usable = rows.filter(
    (r) => r.title && r.officialUrl && !isListPost(r.title) && !isTipPost(r.title)
  );
  console.log(`usable (single scholarship posts): ${usable.length}`);

  const existing = await prisma.scholarship.findMany({
    select: { id: true, slug: true, sourceUrl: true, title: true, provider: true, status: true, deadline: true },
  });
  const existingSlugs = new Set(existing.map((r) => r.slug));
  const existingUrls = new Set(existing.map((r) => r.sourceUrl).filter(Boolean) as string[]);
  // Fingerprint dedupe: same title + provider (case-insensitive) already in DB
  // (e.g. a scholarship also listed by wemakescholars / DAAD).
  const existingFp = new Set(
    existing.map((r) => `${(r.title || "").toLowerCase().slice(0, 80)}|${(r.provider || "").toLowerCase().slice(0, 60)}`)
  );
  const existingByUrl = new Map(
    existing.filter((r) => r.sourceUrl).map((r) => [r.sourceUrl as string, r])
  );

  let created = 0;
  let dup = 0;
  let noCountry = 0;
  let renewed = 0;
  let deadlineUpdated = 0;
  const toCreate: any[] = [];
  const renewals: { id: string; data: any }[] = [];
  const deadlineUpdates: { id: string; deadline: Date }[] = [];
  for (const rec of usable) {
    const title = (rec.title || "").trim();
    const sourceUrlFull = (rec.url || "").trim();
    if (!sourceUrlFull) continue;

    const slugFromTitle = slugify(title);
    const slug = `${slugFromTitle}-s4d`;
    let uniqueSlug = slug;
    let i = 2;
    const inBatch = new Set(toCreate.map((c: any) => c.slug));
    while (existingSlugs.has(uniqueSlug) || inBatch.has(uniqueSlug)) uniqueSlug = `${slug}-${i++}`;

    const fp = `${title.toLowerCase().slice(0, 80)}|${(rec.provider || rec.hostInstitution || "").toLowerCase().slice(0, 60)}`;

    const code = countryCode(rec.country);
    if (!code) noCountry++;

    const { amount, currency, benefits, fundingType } = parseFunding(rec.value);
    const deadline = parseDeadline(rec.deadline);
    const provider = (rec.provider && !/^©|istock|^[a-z0-9._%+-]+@/i.test(rec.provider))
      ? rec.provider.trim()
      : (rec.hostInstitution || "Not specified").trim().slice(0, 120);
    const fields = fieldsOf(rec.fields, `${rec.briefDescription} ${rec.eligibility}`);

    // lastUpdated may be unparseable ("10 months ago", etc.) — guard dates.
    const lastUpdated = rec.lastUpdated ? new Date(rec.lastUpdated) : null;
    const verifiedAt = lastUpdated && !isNaN(lastUpdated.getTime()) ? lastUpdated : null;

    const descriptionParts = [
      rec.briefDescription,
      rec.hostInstitution && `Host institution: ${rec.hostInstitution}`,
      rec.targetGroup && `Target group: ${rec.targetGroup}`,
      rec.value && `Scholarship value: ${rec.value}`,
      rec.eligibility && `Eligibility: ${rec.eligibility}`,
      rec.applicationInstructions && `How to apply: ${rec.applicationInstructions}`,
    ].filter(Boolean);
    const description = descriptionParts.join("\n\n").slice(0, 4000);

    const row = {
      slug: uniqueSlug,
      title,
      description: description || title,
      provider,
      providerType: "UNIVERSITY",
      countryCode: code,
      studyLevels: JSON.stringify(studyLevels(rec.degreeLevel)),
      fields: JSON.stringify(fields),
      degrees: "[]",
      eligibleNationalities: "[]",
      fundingType,
      benefits: JSON.stringify(benefits),
      amount: amount || (rec.value ? rec.value.slice(0, 200) : null),
      currency,
      duration: null,
      deadline,
      deadlineTimezone: null,
      applicationFee: null,
      languageRequirements: "{}",
      academicRequirements: rec.eligibility ? rec.eligibility.slice(0, 2000) : null,
      ageRequirements: null,
      workExperience: null,
      requiredDocuments: "[]",
      applicationSteps: "[]",
      officialUrl: rec.officialUrl,
      sourceUrl: sourceUrlFull,
      recordType: "SCHOLARSHIP",
      verificationStatus: "UNVERIFIED",
      status: "PENDING",
      lastVerifiedAt: verifiedAt,
      submittedNote: `Imported from scholars4dev.com (${sourceUrlFull}) — pending review.`,
      createdAt: verifiedAt ?? new Date(),
    };

    // Re-crawl of an already-imported record: renew it if it expired and the
    // source reopened it; correct the deadline if it changed mid-cycle.
    const urlMatch = existingByUrl.get(sourceUrlFull);
    if (urlMatch) {
      const decision = renewalDecision(urlMatch, row);
      if (decision.kind === "renew") {
        renewals.push(decision);
        renewed++;
      } else if (decision.kind === "update-deadline") {
        deadlineUpdates.push(decision);
        deadlineUpdated++;
      } else {
        dup++;
      }
      continue;
    }
    if (existingFp.has(fp)) {
      dup++;
      continue;
    }

    toCreate.push(row);
    created++;
  }

  console.log(`created: ${created}, duplicates skipped: ${dup}, no-country: ${noCountry}`);
  if (DRY_RUN) {
    console.log("dry run — no writes");
    await prisma.$disconnect();
    return;
  }

  const CHUNK = 50;
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    await createManySkipDuplicates(prisma.scholarship, toCreate.slice(i, i + CHUNK), CHUNK);
    console.log(`inserted ${Math.min(i + CHUNK, toCreate.length)}/${toCreate.length}`);
  }

  const { renewed: rn, deadlineUpdated: du } = await applyRenewals(renewals, deadlineUpdates);
  console.log(`renewals applied: ${rn}, deadline updates applied: ${du}`);

  const inserted = await prisma.scholarship.count({
    where: { sourceUrl: { contains: "scholars4dev.com" } },
  });
  console.log(`Total scholars4dev records in DB: ${inserted}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
