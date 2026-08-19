import { createManySkipDuplicates } from "./lib/insert-many";
import { renewalDecision, applyRenewals } from "./lib/insert-or-renew";
/* Import DAAD scholarship database (156 programs) from data/daad-details.jsonl.
 *
 * Maps DAAD detail fields to the Scholarship schema:
 *   title            -> title
 *   description      -> description (Programme Description)
 *   target_group     -> eligibleNationalities-ish notes + academicRequirements
 *   academic_req     -> academicRequirements
 *   duration         -> duration
 *   value            -> amount + benefits (parsed)
 *   deadline         -> deadline (parsed when a concrete date)
 *   weblink          -> officialUrl (external provider site)
 *   DAAD detail URL  -> sourceUrl
 *   subjectGrps A-G  -> fields
 *
 * Records are created as ACTIVE with sourceUrl pointing at the official DAAD
 * database entry; dedupe by (title + provider) and by sourceUrl.
 *
 * Usage:
 *   npx tsx scripts/import-daad.ts --dry-run
 *   npx tsx scripts/import-daad.ts
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

const SUBJECT_GROUPS: Record<string, string[]> = {
  A: ["agriculture", "natural-sciences"],
  B: ["engineering"],
  C: ["medicine", "public-health"],
  D: ["natural-sciences", "mathematics"],
  E: ["arts", "design", "media"],
  F: ["business", "economics", "law", "social-sciences"],
  G: ["education", "linguistics"],
};

function parseDeadline(text: string): Date | null {
  if (!text) return null;
  const t = text.toLowerCase();
  // concrete dates: "15 July 2026", "1 March and 1 September of each year", "July 15, 2026"
  const m = t.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})|([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (!m) return null;
  const day = m[1] || m[5];
  const month = m[2] || m[4];
  const year = m[3] || m[6];
  const d = new Date(`${month} ${day}, ${year}`);
  return isNaN(d.getTime()) ? null : d;
}

function parseAmount(value: string): { amount: string | null; currency: string | null; benefits: string[] } {
  const benefits: string[] = [];
  let amount: string | null = null;
  let currency: string | null = null;
  const t = value.toLowerCase();
  const m = value.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(eur|euro|€|usd|us\$|\$)/i);
  if (m) {
    amount = m[0].trim();
    const code = m[2].toUpperCase();
    currency = code.includes("EUR") || code.includes("€") || code.includes("EURO") ? "EUR" : code.includes("USD") || code === "$" ? "USD" : null;
  }
  if (/\btuition|full fee|fee waiver|course fees?/.test(t)) benefits.push("tuition");
  if (/\bstipend|monthly|allowance|maintenance/.test(t)) benefits.push("stipend");
  if (/\baccommodation|housing|dormitory/.test(t)) benefits.push("accommodation");
  if (/\binsurance|medical cover/.test(t)) benefits.push("insurance");
  if (/\btravel (?:allowance|grant)|airfare|flight/.test(t)) benefits.push("airfare");
  return { amount, currency, benefits };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}

function titleCaseName(rec: any): string {
  // Title is like "State of Bavaria: Max Weber Programme" — provider is the
  // part before ":"
  const title = rec.title || "";
  const parts = title.split(":");
  const provider = parts.length > 1 ? parts[0].trim() : "DAAD";
  return provider;
}

async function main() {
  const rows: any[] = [];
  for (const line of readFileSync("data/daad-details.jsonl", "utf8").split("\n")) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line));
  }
  console.log(`DAAD records: ${rows.length}`);

  // Existing records for dedupe + renewal
  const existing = await prisma.scholarship.findMany({
    select: { id: true, slug: true, sourceUrl: true, status: true, deadline: true },
  });
  const existingSlugs = new Set(existing.map((r) => r.slug));
  const existingUrls = new Set(existing.map((r) => r.sourceUrl).filter(Boolean) as string[]);
  const existingByUrl = new Map(
    existing.filter((r) => r.sourceUrl).map((r) => [r.sourceUrl as string, r])
  );

  let created = 0;
  let dup = 0;
  let renewed = 0;
  let deadlineUpdated = 0;
  const toCreate: any[] = [];
  const renewals: { id: string; data: any }[] = [];
  const deadlineUpdates: { id: string; deadline: Date }[] = [];
  for (const rec of rows) {
    const title = rec.title || "";
    if (!title) continue;

    const { amount, currency, benefits } = parseAmount(rec.value || "");
    const deadline = parseDeadline(rec.deadline || "");
    // A program covering all 7 subject groups is open to every field -> ["ALL"]
    // (the app renders "All fields" and search matches any field filter).
    const groups: string[] = rec.subjectGrps || [];
    const fields: string[] =
      groups.length >= 6
        ? ["ALL"]
        : [...new Set(groups.flatMap((g: string) => SUBJECT_GROUPS[g] ?? []))];

    // Dedupe: by sourceUrl (DAAD detail URL) or by slug
    const detailUrl = `https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/?detail=${rec.id}`;
    const slug = `${slugify(title)}-daad`;
    let uniqueSlug = slug;
    let i = 2;
    while (existingSlugs.has(uniqueSlug)) uniqueSlug = `${slug}-${i++}`;

    const fundingType = benefits.includes("stipend") ? "FULLY_FUNDED_STIPEND" : benefits.includes("tuition") ? "FULLY_FUNDED" : "PARTIAL";
    const academicParts = [rec.academic_req, rec.target_group].filter(Boolean).join(" | ");

    const row = {
      slug: uniqueSlug,
      title,
      description: rec.description || null,
      provider: titleCaseName(rec),
      providerType: rec.isDaad === 1 ? "GOVERNMENT" : "FOUNDATION",
      countryCode: "DE",
      studyLevels: JSON.stringify(["PhD", "Master's", "Postdoctoral"].filter((l) => {
        const t = (rec.target_group || "").toLowerCase() + " " + (rec.academic_req || "").toLowerCase();
        if (l === "PhD") return /doctor|ph\.?d|doctoral/.test(t);
        if (l === "Master's") return /master/.test(t);
        if (l === "Postdoctoral") return /post[- ]?doc|postdoctoral/.test(t);
        return false;
      })),
      fields: JSON.stringify(fields),
      fundingType,
      benefits: JSON.stringify(benefits),
      amount: amount || (rec.value ? rec.value.slice(0, 200) : null),
      currency: currency || (amount ? "EUR" : null),
      duration: rec.duration || null,
      deadline,
      deadlineTimezone: null,
      academicRequirements: academicParts || null,
      applicationSteps: "[]",
      requiredDocuments: "[]",
      languageRequirements: "{}",
      eligibleNationalities: "[]",
      officialUrl: rec.weblink || null,
      sourceUrl: detailUrl,
      recordType: "SCHOLARSHIP",
      verificationStatus: "UNVERIFIED",
      status: "ACTIVE",
    };

    // Re-crawl of an already-imported record: renew it if it expired and the
    // source reopened it; correct the deadline if it changed mid-cycle.
    const urlMatch = existingByUrl.get(detailUrl);
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
    if (existingSlugs.has(slug)) {
      dup++;
      continue;
    }

    toCreate.push(row);
    created++;
  }

  console.log(`created: ${created}, duplicates skipped: ${dup}, renewed: ${renewed}, deadlines updated: ${deadlineUpdated}`);
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
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
