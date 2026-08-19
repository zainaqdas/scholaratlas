import { createManySkipDuplicates } from "./lib/insert-many";
import { renewalDecision, applyRenewals } from "./lib/insert-or-renew";
/* Import the Campus Bourses (Campus France) official scholarship database
 * (380 programs) from data/campusbourses/campusbourses.jsonl (crawled by
 * scripts/crawl-campusbourses.py).
 *
 * Maps each program to the Scholarship schema:
 *   title            -> title
 *   synthese + description + montant + duree + conditions + notes -> description
 *   levels           -> studyLevels (Bachelor/Master/PhD/Postdoctoral)
 *   domains          -> fields (domain label -> app field slugs)
 *   nationalities    -> eligibleNationalities (ISO codes)
 *   funder           -> providerType (French gov, EU, foundations, ...)
 *   montant          -> amount + benefits + fundingType (parsed)
 *   duree            -> duration
 *   dateEnd          -> deadline
 *   inscriptionUrl / url1 / url2 -> officialUrl
 *   Campus Bourses program URL   -> sourceUrl
 *
 * This is the official database of the French government's Campus France
 * agency, so records are mostly grants to study in France (countryCode FR);
 * a small explicit override list handles the few mobility programs whose
 * destination is another country (Mitacs -> CA, Marietta Blau -> AT, ...).
 *
 * Records are inserted as PENDING, then activated/expired by deadline in a
 * follow-up step (same flow as the scholars4dev import).
 *
 * Usage:
 *   npx tsx scripts/import-campusbourses.ts --dry-run
 *   npx tsx scripts/import-campusbourses.ts
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

// --- Study levels: Campus Bourses names -> app study-level slugs ------------
// (slugs are what the level filter and card rendering match)
const LEVEL_MAP: Record<string, string> = {
  Bachelor: "undergraduate",
  Master: "masters",
  PhD: "phd",
  Postdoctoral: "postdoctoral",
};

// --- Fields of study: domain label -> app field slugs ------------------------
const DOMAIN_FIELDS: Record<string, string[]> = {
  "Agronomy - Agroalimentary": ["agriculture"],
  "Architecture - Urban and Regional Planning": ["architecture"],
  "Arts - Culture - Design - Fashion": ["arts", "design"],
  "Biology": ["biology"],
  "Chemistry": ["chemistry"],
  "Communication - Journalism": ["media"],
  "Law": ["law"],
  "Environment": ["environmental-science", "natural-sciences"],
  "Computer Science": ["computer-science"],
  "Literature - Languages": ["arts", "linguistics"],
  "Management - Business Administration - Finances": ["business", "finance"],
  "Mathematics": ["mathematics"],
  "Physical Sciences": ["physics", "natural-sciences"],
  "Health - Community Services": ["medicine", "public-health"],
  "Education": ["education"],
  "Engineering": ["engineering"],
  "Economics - Politics": ["economics", "political-science"],
  "Humanities - Social Sciences": ["social-sciences", "arts"],
  "Sports": ["sports-science"],
  "Tourism and Hospitality - Food Service": ["tourism"],
  "Transportation - Logistics": ["engineering"],
};

// --- Funder -> providerType --------------------------------------------------
function providerTypeFrom(funder: string): string {
  const f = funder.toLowerCase();
  if (/french government|foreign governments/.test(f)) return "GOVERNMENT";
  if (/higher education institutions/.test(f)) return "UNIVERSITY";
  if (/foundations and associations/.test(f)) return "FOUNDATION";
  if (/european union|international and bilateral/.test(f)) return "INTERNATIONAL_ORGANIZATION";
  if (/enterprises|foreign organisations/.test(f)) return "PRIVATE";
  return "NGO";
}

// --- Non-France destination overrides (destination stated in the program) ----
const DESTINATION_OVERRIDES: [RegExp, string][] = [
  [/^Mitacs Globalink Research Award/i, "CA"],
  [/^Marietta Blau Scholarship/i, "AT"],
  [/^Erwin-Schrödinger/i, "AT"],
  [/^Research Internship Abroad Scholarship \(BEPE\)/i, "BR"],
];

// --- Funding parsing (montant text) ------------------------------------------
function parseFunding(montant: string | undefined): {
  amount: string | null; currency: string | null; benefits: string[];
  fundingType: string;
} {
  const benefits: string[] = [];
  const t = (montant ?? "").toLowerCase();
  let amount: string | null = null;
  let currency: string | null = null;
  const m = (montant ?? "").match(
    /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(eur|euro|€|usd|us\$|\$|gbp|£|cad|c\$|aud|chf|sek|jpy|¥)/i
  );
  if (m) {
    amount = m[0].trim();
    const code = m[2].toUpperCase();
    if (code.includes("EUR") || code.includes("€") || code.includes("EURO")) currency = "EUR";
    else if (code.includes("USD") || code === "$" || code.includes("US$")) currency = "USD";
    else if (code.includes("GBP") || code.includes("£")) currency = "GBP";
    else if (code.includes("CAD") || code.includes("C$")) currency = "CAD";
    else if (code.includes("AUD")) currency = "AUD";
    else if (code.includes("CHF")) currency = "CHF";
    else if (code.includes("SEK")) currency = "SEK";
    else if (code.includes("JPY") || code.includes("¥")) currency = "JPY";
  }
  if (/\btuition|fee waiver|exemption.*fee|full fee|cours(e|es) fees|registration fee/.test(t)) benefits.push("tuition");
  if (/\bstipend|monthly (allowance|stipend)|maintenance|allowance/.test(t)) benefits.push("stipend");
  if (/\baccommodation|housing|dormitory|room and board|logement/.test(t)) benefits.push("accommodation");
  if (/\binsurance|medical cover|social security cover|mutuelle/.test(t)) benefits.push("insurance");
  if (/\btravel (?:allowance|grant)|airfare|flight|transport (?:costs|allowance)/.test(t)) benefits.push("airfare");
  if (/\bvisa/.test(t)) benefits.push("visa");

  const fullyFunded =
    /fully funded|full tuition|full funding|full cost|cover(s|ed)? (all|everything)|all (tuition|costs|expenses)/i.test(t);
  const hasStipend = /stipend|monthly (allowance|salary)|living (allowance|expenses|cost)|maintenance grant/i.test(t);
  const fundingType = hasStipend && fullyFunded
    ? "FULLY_FUNDED_STIPEND"
    : fullyFunded
      ? "FULLY_FUNDED"
      : benefits.includes("tuition") && /partial|waiver|reduction/i.test(t)
        ? "TUITION_WAIVER"
        : "PARTIAL";
  return { amount, currency, benefits, fundingType };
}

// --- Required documents from the "pieces" prose -------------------------------
function documentsFrom(pieces: string | undefined): string[] {
  if (!pieces) return [];
  const t = pieces.toLowerCase();
  const docs: string[] = [];
  if (/\bpassport\b|identity (card|document)/.test(t)) docs.push("passport");
  if (/transcript|academic record|marksheet|grades? certificate/.test(t)) docs.push("transcripts");
  if (/\bcv\b|resume|curriculum vitae/.test(t)) docs.push("cv");
  if (/motivation letter|statement of purpose|personal statement/.test(t)) docs.push("motivationLetter");
  if (/recommendation letters?|reference letters?/.test(t)) docs.push("recommendationLetters");
  if (/research proposal|project proposal/.test(t)) docs.push("researchProposal");
  if (/portfolio/.test(t)) docs.push("portfolio");
  if (docs.length === 0 && pieces.trim()) docs.push("other");
  return docs;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

async function main() {
  const rows: any[] = [];
  for (const line of readFileSync("data/campusbourses/campusbourses.jsonl", "utf8").split("\n")) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line));
  }
  console.log(`Campus Bourses records: ${rows.length}`);

  const usable = rows.filter((r) => r.title && (r.url1 || r.url2 || r.inscriptionUrl));
  console.log(`usable (with official URL): ${usable.length}`);

  const existing = await prisma.scholarship.findMany({
    select: { id: true, slug: true, sourceUrl: true, title: true, provider: true, status: true, deadline: true },
  });
  const existingSlugs = new Set(existing.map((r) => r.slug));
  const existingUrls = new Set(existing.map((r) => r.sourceUrl).filter(Boolean) as string[]);
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
    const sourceUrlFull = `https://campusbourses.campusfrance.org/program/${rec.bourseId}`;

    const slugBase = slugify(title);
    const slug = `${slugBase}-cf`;
    let uniqueSlug = slug;
    let i = 2;
    const inBatch = new Set(toCreate.map((c: any) => c.slug));
    while (existingSlugs.has(uniqueSlug) || inBatch.has(uniqueSlug)) uniqueSlug = `${slug}-${i++}`;

    const fp = `${title.toLowerCase().slice(0, 80)}|${(rec.web1 || rec.funder || "").toLowerCase().slice(0, 60)}`;

    // Destination: default France; override for the few mobility programs.
    let countryCode: string | null = "FR";
    for (const [re, code] of DESTINATION_OVERRIDES) {
      if (re.test(title)) { countryCode = code; break; }
    }

    const { amount, currency, benefits, fundingType } = parseFunding(rec.montant);
    const deadline = rec.dateEnd ? new Date(`${rec.dateEnd}T00:00:00Z`) : null;
    const levels = (rec.levels || []).map((l: string) => LEVEL_MAP[l]).filter(Boolean);
    const fields = [...new Set((rec.domains || []).flatMap((d: string) => DOMAIN_FIELDS[d] ?? []))];
    const provider = rec.web1 || rec.funder || "Campus France";

    const descriptionParts = [
      rec.synthese,
      rec.description,
      rec.montant && `Scholarship value: ${rec.montant}`,
      rec.duree && `Duration: ${rec.duree}`,
      rec.maitriseLangue && `Language requirement: ${rec.maitriseLangue}`,
      rec.conditions && `Additional conditions: ${rec.conditions}`,
      rec.age && `Age requirement: ${rec.age}`,
      rec.levelNote && `Study level notes: ${rec.levelNote}`,
      rec.countryNote && `Nationality notes: ${rec.countryNote}`,
      rec.pieces && `Required documents: ${rec.pieces}`,
      rec.dates && `Application dates: ${rec.dates}`,
      rec.inscription && `How to apply: ${rec.inscription}`,
      rec.selection && `Selection process: ${rec.selection}`,
      rec.contact && `Contact: ${rec.contact}`,
    ].filter(Boolean);
    const description = descriptionParts.join("\n\n").slice(0, 5000);

    const academicParts = [rec.levelNote, rec.countryNote, rec.conditions, rec.age].filter(Boolean).join(" | ");

    const row = {
      slug: uniqueSlug,
      title,
      description: description || title,
      provider: provider.slice(0, 150),
      providerType: providerTypeFrom(rec.funder),
      countryCode,
      city: null,
      studyLevels: JSON.stringify(levels),
      fields: JSON.stringify(fields),
      degrees: "[]",
      eligibleNationalities: JSON.stringify(rec.nationalities || []),
      fundingType,
      benefits: JSON.stringify(benefits),
      amount: amount || (rec.montant ? rec.montant.slice(0, 250) : null),
      currency,
      duration: rec.duree || null,
      deadline,
      deadlineTimezone: null,
      applicationFee: null,
      languageRequirements: "{}",
      academicRequirements: academicParts || null,
      ageRequirements: rec.age || null,
      workExperience: null,
      requiredDocuments: JSON.stringify(documentsFrom(rec.pieces)),
      applicationSteps: JSON.stringify(rec.inscription ? [rec.inscription] : []),
      officialUrl: rec.inscriptionUrl || rec.url1 || rec.url2 || null,
      sourceUrl: sourceUrlFull,
      recordType: "SCHOLARSHIP",
      verificationStatus: "UNVERIFIED",
      status: "PENDING",
      lastVerifiedAt: rec.updatedAt ? new Date(`${rec.updatedAt}T00:00:00Z`) : null,
      submittedNote: `Imported from Campus Bourses (Campus France official database) ${sourceUrlFull} — pending review.`,
      createdAt: rec.updatedAt ? new Date(`${rec.updatedAt}T00:00:00Z`) : new Date(),
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
    where: { sourceUrl: { contains: "campusbourses.campusfrance.org" } },
  });
  console.log(`Total Campus Bourses records in DB: ${inserted}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
