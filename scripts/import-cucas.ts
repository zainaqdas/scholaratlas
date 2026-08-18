import { createManySkipDuplicates } from "./lib/insert-many";
/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// CUCAS China Scholarship importer.
//
// CUCAS (cucas.cn) is the largest aggregator of China scholarship/program
// listings for international students. Cleaned snapshots of its data are
// published on Kaggle — we import those instead of scraping campuschina.org
// directly. Sources:
//   - May 2019 snapshot: https://www.kaggle.com/datasets/mcmuralishclint96/china-scholarship-data-may-2019
//   - Aug 2023 snapshot: https://www.kaggle.com/datasets/sakchaisaehoei/china-scholarship-data-2023
//
// What this importer does:
//   1. Reads both CSVs (committed under scrapers/cucas/).
//   2. Creates University records for every host university (country CN).
//   3. Maps each (university, program, level) listing to a Scholarship:
//      funding type derived from the coverage columns, benefits set from
//      tuition/accommodation/living coverage, fields inferred from the
//      program name. Rows with zero coverage (self-funded programs) are
//      skipped — they are not scholarships.
//   4. Prefers the newer 2023 snapshot when the same listing appears twice.
//   5. Inserts everything as PENDING/UNVERIFIED for admin review — nothing
//      is published automatically. Unknown values stay unknown.
//
// Usage:
//   npm run import:cucas                 # import everything new
//   npm run import:cucas -- --dry-run    # report only, no writes
//   npm run import:cucas -- --limit 50   # cap inserts (testing)
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/utils";

const args = process.argv.slice(2);
const flagValue = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const DIR = flagValue("dir") ?? "scrapers/cucas";
const LIMIT = Number(flagValue("limit") ?? 0) || 0;
const DRY_RUN = args.includes("--dry-run");

const FILES = [
  { path: `${DIR}/cucas-china-scholarships-2023.csv`, vintage: "Aug 2023" },
  { path: `${DIR}/cucas-china-scholarships-2019.csv`, vintage: "May 2019" },
];

const KAGGLE_2023 = "https://www.kaggle.com/datasets/sakchaisaehoei/china-scholarship-data-2023";
const KAGGLE_2019 = "https://www.kaggle.com/datasets/mcmuralishclint96/china-scholarship-data-may-2019";

const LEVEL_LABEL: Record<string, string> = {
  Bachelor: "Bachelor's",
  Master: "Master's",
  Phd: "PhD",
  "Non-Degree": "Non-degree",
  Associate: "Associate",
};

const LEVEL_SLUG: Record<string, string> = {
  Bachelor: "undergraduate",
  Master: "masters",
  Phd: "phd",
  "Non-Degree": "short-course",
  Associate: "undergraduate",
};

// --- field inference from program names ------------------------------------
const FIELD_KEYWORDS: [string, string][] = [
  ["computer science", "computer-science"],
  ["software engineering", "computer-science"],
  ["software", "computer-science"],
  ["computer", "computer-science"],
  ["information technology", "computer-science"],
  ["informatics", "computer-science"],
  ["artificial intelligence", "artificial-intelligence"],
  ["intelligence science", "artificial-intelligence"],
  ["data science", "data-science"],
  ["big data", "data-science"],
  ["data analytics", "data-science"],
  ["cybersecurity", "cybersecurity"],
  ["cyber security", "cybersecurity"],
  ["information security", "cybersecurity"],
  ["engineering", "engineering"],
  ["automation", "engineering"],
  ["mechanical", "engineering"],
  ["civil engineering", "engineering"],
  ["electrical", "engineering"],
  ["chemical engineering", "engineering"],
  ["materials", "engineering"],
  ["vehicle", "engineering"],
  ["power engineering", "engineering"],
  ["control science", "engineering"],
  ["biomedical engineering", "biotechnology"],
  ["bioengineering", "biotechnology"],
  ["biotechnology", "biotechnology"],
  ["biological", "biology"],
  ["biology", "biology"],
  ["ecology", "biology"],
  ["life science", "biology"],
  ["clinical medicine", "medicine"],
  ["medicine", "medicine"],
  ["medical", "medicine"],
  ["pharmacology", "medicine"],
  ["pharmacy", "medicine"],
  ["pharmaceutical", "medicine"],
  ["nursing", "nursing"],
  ["public health", "public-health"],
  ["chemistry", "chemistry"],
  ["physics", "physics"],
  ["mathematics", "mathematics"],
  ["math", "mathematics"],
  ["statistics", "mathematics"],
  ["environmental", "environmental-science"],
  ["environment", "environmental-science"],
  ["business administration", "business"],
  ["business", "business"],
  ["management", "business"],
  ["mba", "business"],
  ["commerce", "business"],
  ["marketing", "marketing"],
  ["advertising", "marketing"],
  ["accounting", "accounting"],
  ["finance", "finance"],
  ["financial", "finance"],
  ["economics", "economics"],
  ["economy", "economics"],
  ["law", "law"],
  ["political", "political-science"],
  ["public administration", "political-science"],
  ["international politics", "political-science"],
  ["international relations", "international-relations"],
  ["international trade", "international-relations"],
  ["psychology", "psychology"],
  ["education", "education"],
  ["agriculture", "agriculture"],
  ["agronomy", "agriculture"],
  ["food science", "agriculture"],
  ["architecture", "architecture"],
  ["urban planning", "architecture"],
  ["urban and rural planning", "architecture"],
  ["landscape", "architecture"],
  ["fine arts", "arts"],
  ["art", "arts"],
  ["design", "design"],
  ["media", "media"],
  ["journalism", "media"],
  ["communication", "media"],
  ["tourism", "tourism"],
  ["hotel", "tourism"],
  ["english", "linguistics"],
  ["japanese", "linguistics"],
  ["chinese language", "linguistics"],
  ["linguistics", "linguistics"],
  ["translation", "linguistics"],
  ["history", "history"],
  ["philosophy", "philosophy"],
  ["music", "music"],
  ["sports", "sports-science"],
  ["physical education", "sports-science"],
];

function inferFields(program: string): string[] {
  const p = program.toLowerCase();
  const found = new Set<string>();
  for (const [kw, slug] of FIELD_KEYWORDS) {
    if (p.includes(kw)) found.add(slug);
  }
  return [...found];
}

// --- funding helpers ---------------------------------------------------------
function covered(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = String(value).trim().toLowerCase();
  if (v === "" || v === "0" || v === "0.0" || v === "no" || v === "none" || v === "no.") return false;
  return true;
}

function isFreeValue(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = String(value).trim().toLowerCase();
  return v === "yes" || v === "free" || v === "0" || v === "0.0" || v === "";
}

function tuitionFull(coveredVal: string | undefined | null, payVal: string | undefined | null): boolean {
  // Full tuition = covered AND nothing left for the student to pay.
  if (!covered(coveredVal)) return false;
  return isFreeValue(payVal) || !covered(payVal);
}

interface CucasRow {
  university: string;
  program: string;
  level: string;
  language: string;
  tuitionCovered: string;
  accCovered: string;
  livingCovered: string;
  tuitionPay: string;
  originalTuition: string;
  startText: string;
  logo?: string;
  vintage: string;
}

function toRow(rec: Record<string, string>, vintage: string, is2019: boolean): CucasRow {
  return {
    university: (rec.University || "").trim(),
    program: (is2019 ? rec.Major : rec.Program || "").trim(),
    level: (rec.Level || "").trim(),
    language: (rec.Language || "").trim(),
    tuitionCovered: (rec["Tuition Covered"] || "").trim(),
    accCovered: (rec["Accomodation covered?"] || rec["Accommodation covered?"] || "").trim(),
    livingCovered: (rec["Living Expense Covered?"] || "").trim(),
    tuitionPay: (rec["Tuition fees to pay"] || "").trim(),
    originalTuition: (rec["Original Tuition fee"] || "").trim(),
    startText: is2019
      ? `${rec.Start_Month || ""} ${rec.Start_Year || ""}`.trim()
      : (rec["Start Date"] || "").trim(),
    logo: rec["School Logo"] || undefined,
    vintage,
  };
}

function fundingOf(r: CucasRow): { type: string; benefits: string[]; amount: string } | null {
  const t = covered(r.tuitionCovered);
  const a = covered(r.accCovered);
  const l = covered(r.livingCovered);
  if (!t && !a && !l) return null; // not a scholarship — self-funded program
  const fullT = t && tuitionFull(r.tuitionCovered, r.tuitionPay);

  const benefits: string[] = [];
  if (t) benefits.push("tuition");
  if (a) benefits.push("accommodation");
  if (l) benefits.push("stipend");

  let type: string;
  if (fullT && a && l) type = "FULLY_FUNDED_STIPEND";
  else if (fullT && (a || l)) type = "FULLY_FUNDED";
  else if (fullT) type = "TUITION_WAIVER";
  else type = "PARTIAL";

  const parts: string[] = [];
  if (t) parts.push(`Tuition: ${r.tuitionCovered} CNY`);
  if (a) parts.push("Accommodation covered");
  if (l) parts.push("Living expenses covered");
  return { type, benefits, amount: parts.join(" · ") || "Coverage details on request" };
}

// --- main -------------------------------------------------------------------
async function main() {
  const rows: CucasRow[] = [];
  for (const f of FILES) {
    let raw: string;
    try {
      raw = readFileSync(f.path, "utf-8");
    } catch {
      console.error(`Cannot read ${f.path}.`);
      process.exit(1);
    }
    const recs = parse(raw, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
    const is2019 = f.path.includes("2019");
    for (const rec of recs) rows.push(toRow(rec, f.vintage, is2019));
  }
  console.log(`Read ${rows.length} rows from ${FILES.length} files.`);

  // Skip self-funded programs, then dedupe by (university, program, level),
  // preferring the newer snapshot.
  let selfFunded = 0;
  const byKey = new Map<string, CucasRow>();
  for (const r of rows) {
    if (!r.university || !r.program) continue;
    const funding = fundingOf(r);
    if (!funding) {
      selfFunded += 1;
      continue;
    }
    const key = `${r.university.toLowerCase()}\u0000${r.program.toLowerCase()}\u0000${r.level.toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing || (existing.vintage === "May 2019" && r.vintage === "Aug 2023")) {
      byKey.set(key, r);
    }
  }
  const listings = [...byKey.values()];
  console.log(`Scholarship listings after dedupe: ${listings.length} (${selfFunded} self-funded rows excluded)`);

  // Universities — upsert by slug, reuse existing records with the same name.
  const uniNames = [...new Set(listings.map((r) => r.university))];
  const existingUnis = await prisma.university.findMany({ select: { id: true, name: true, slug: true } });
  const uniByName = new Map(existingUnis.map((u) => [u.name.toLowerCase(), u]));
  const uniSlugs = new Set(existingUnis.map((u) => u.slug));
  const uniIdByName = new Map<string, string>();
  const newUnis: { slug: string; name: string; countryCode: string; logoText: string; color: string }[] = [];

  for (const name of uniNames) {
    const existing = uniByName.get(name.toLowerCase());
    if (existing) {
      uniIdByName.set(name, existing.id);
      continue;
    }
    let slug = slugify(name) || "china-university";
    while (uniSlugs.has(slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    uniSlugs.add(slug);
    const initials = name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
    const colors = ["#6B21A8", "#BE185D", "#B91C1C", "#C2410C", "#A16207", "#15803D", "#0E7490", "#1D4ED8"];
    const color = colors[name.length % colors.length];
    uniIdByName.set(name, "");
    newUnis.push({ slug, name, countryCode: "CN", logoText: initials, color });
  }

  let uniCreated = 0;
  if (newUnis.length && !DRY_RUN) {
    uniCreated = await createManySkipDuplicates(prisma.university, newUnis);
    const created = await prisma.university.findMany({ where: { slug: { in: newUnis.map((u) => u.slug) } } });
    for (const u of created) uniIdByName.set(u.name, u.id);
  }
  console.log(
    DRY_RUN
      ? `Universities: ${uniNames.length} total | would create ${newUnis.length} new`
      : `Universities: ${uniNames.length} total | ${uniCreated} new | ${uniNames.length - uniCreated} existing`
  );

  // Existing scholarship titles for dedupe (title+provider natural key).
  const existingScholarships = await prisma.scholarship.findMany({
    select: { title: true, provider: true },
  });
  const seenTitles = new Set(existingScholarships.map((s) => `${s.title}\u0000${s.provider}`));

  const now = new Date();
  const slugSet = new Set<string>();
  const toInsert: Record<string, unknown>[] = [];

  for (const r of listings) {
    const funding = fundingOf(r)!;
    const levelLabel = LEVEL_LABEL[r.level] ?? r.level;
    const title = `${r.program} — ${r.university} (${levelLabel})`;
    const naturalKey = `${title}\u0000${r.university}`;
    if (seenTitles.has(naturalKey)) continue; // already in the DB

    let slug = slugify(title).slice(0, 90) || "cucas-listing";
    while (slugSet.has(slug)) slug = `${slug.slice(0, 80)}-${Math.random().toString(36).slice(2, 5)}`;
    slugSet.add(slug);

    const fields = inferFields(r.program);
    const studyLevels = LEVEL_SLUG[r.level] ? [LEVEL_SLUG[r.level]] : [];
    const sourceUrl = r.vintage === "Aug 2023" ? KAGGLE_2023 : KAGGLE_2019;
    const langNote = r.language ? ` Language of instruction: ${r.language}.` : "";
    const startNote = r.startText ? ` Intake: ${r.startText}.` : "";
    const amountNote = funding.amount;

    toInsert.push({
      slug,
      title,
      description: `${r.program} at ${r.university} (${levelLabel}${r.language ? `, ${r.language}` : ""}).${langNote}${startNote} Coverage: ${amountNote}. Source: CUCAS China Scholarship dataset (${r.vintage}, via Kaggle) — verify current details on the university's official website before applying.`,
      provider: r.university,
      providerType: "UNIVERSITY",
      universityId: uniIdByName.get(r.university) ?? null,
      countryCode: "CN",
      city: null,
      studyLevels: JSON.stringify(studyLevels),
      fields: JSON.stringify(fields),
      degrees: JSON.stringify([]),
      eligibleNationalities: JSON.stringify(["ALL"]),
      fundingType: funding.type,
      benefits: JSON.stringify(funding.benefits),
      amount: amountNote || null,
      currency: "CNY",
      duration: null,
      deadline: null,
      deadlineTimezone: null,
      applicationFee: null,
      languageRequirements: JSON.stringify({}),
      academicRequirements: null,
      ageRequirements: null,
      workExperience: null,
      requiredDocuments: JSON.stringify([]),
      applicationSteps: JSON.stringify([]),
      officialUrl: null,
      sourceUrl,
      featuredImage: null,
      verificationStatus: "UNVERIFIED",
      status: "PENDING",
      lastVerifiedAt: null,
      isFeatured: false,
      isTrending: false,
      views: 0,
      submittedByName: null,
      submittedEmail: null,
      submittedNote: `Imported from CUCAS China Scholarship dataset (${r.vintage}, via Kaggle) on ${now.toISOString().slice(0, 10)} — pending review.`,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (DRY_RUN) {
    console.log(`[dry-run] Would insert ${toInsert.length} scholarships.`);
    for (const s of toInsert.slice(0, LIMIT || 8)) {
      console.log(`  - ${String(s.title).slice(0, 70)} | ${s.fundingType} | ${s.provider}`);
    }
    return;
  }

  let final = toInsert;
  if (LIMIT > 0) final = toInsert.slice(0, LIMIT);

  let inserted = 0;
  if (final.length) {
    inserted = await createManySkipDuplicates(prisma.scholarship, final);
  }

  console.log(`Inserted: ${inserted} | Skipped (already imported): ${toInsert.length - inserted}`);
  console.log(`Self-funded rows excluded: ${selfFunded}`);
  console.log(inserted > 0 ? "Imported records are PENDING — review them at /admin." : "Nothing new to import.");
}

main()
  .catch((err) => {
    console.error("Import failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
