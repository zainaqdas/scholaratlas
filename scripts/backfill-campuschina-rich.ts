/* Parse rich fields for the 9 campuschina.org records from their long
 * description text (the official CSC program pages carry real benefit/level/
 * language/eligibility content in prose).
 *
 * Usage:
 *   npx tsx scripts/backfill-campuschina-rich.ts --dry-run
 *   npx tsx scripts/backfill-campuschina-rich.ts
 */
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

function parseBenefits(text: string): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  if (/\btuition waiver\b|tuition-free|tuition free|full tuition|waives? (?:the )?tuition|no tuition/.test(t)) out.push("tuition");
  if (/\bstipend|monthly allowance|living allowance|maintenance (?:allowance|stipend)/.test(t)) out.push("stipend");
  if (/\baccommodation\b|housing|dormitory/.test(t)) out.push("accommodation");
  if (/\bmedical insurance|health insurance|comprehensive insurance/.test(t)) out.push("insurance");
  if (/\bair ?fare|international air|round-trip air|flight|travel expenses/.test(t)) out.push("airfare");
  if (/\bvisa (?:support|fee|assistance)/.test(t)) out.push("visaSupport");
  return out;
}

function parseLevels(text: string): string[] {
  // Canonical slugs — display names like "Master's" never match the level filter.
  const t = text.toLowerCase();
  const out: string[] = [];
  if (/\bpost[- ]?doctoral|post-doc\b/.test(t)) out.push("postdoctoral");
  if (/\bph\.?d|doctoral|doctorate/.test(t)) out.push("phd");
  if (/\bmaster|postgraduate/.test(t)) out.push("masters");
  if (/\bundergraduate|bachelor|undergrad/.test(t)) out.push("undergraduate");
  if (/\bexchange|short[- ]term|training course/.test(t)) out.push("exchange-program");
  return out;
}

function parseLanguage(text: string): Record<string, boolean> | null {
  const t = text.toLowerCase();
  const out: Record<string, boolean> = {};
  const mentionsEnglish = /\benglish\b/.test(t);
  if (/teaching language[^.]*english|taught in english|language of instruction[^.]*english/.test(t)) {
    out.altProof = true;
  }
  if (mentionsEnglish && !out.altProof) out.altProof = true;
  if (/ielts/.test(t)) out.ielts = true;
  if (/toefl/.test(t)) out.toefl = true;
  return Object.keys(out).length ? out : null;
}

function parseDeadline(text: string): string | null {
  const m = text.match(/(?:deadline|closing date|application (?:deadline|date))[^.]{0,40}?([A-Z][a-z]+ \d{1,2},? \d{4})/);
  if (m) return m[1];
  return null;
}

function parseEligibility(text: string): string | null {
  const m = text.match(/(?:eligibility|application requirements|who can apply)[\s\S]{0,10}?([\s\S]{100,600}?)(?:\n\s*(?:\d+\.|[A-Z][A-Za-z ]{5,}:)|$)/i);
  return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 600) : null;
}

async function main() {
  const records = await prisma.scholarship.findMany({
    where: { status: "ACTIVE", recordType: "SCHOLARSHIP", sourceUrl: { contains: "campuschina" } },
    select: { id: true, title: true, description: true, benefits: true, studyLevels: true, languageRequirements: true, deadline: true, academicRequirements: true, fields: true },
  });
  console.log(`campuschina records: ${records.length}`);

  const updates: any[] = [];
  for (const rec of records) {
    const d = rec.description || "";
    if (d.length < 100) continue;
    const data: any = {};

    const benefits = parseBenefits(d);
    if (benefits.length && (rec.benefits || "[]") === "[]") {
      data.benefits = JSON.stringify(benefits);
      if (benefits.includes("tuition") && (benefits.includes("stipend") || benefits.includes("accommodation"))) data.fundingType = "FULLY_FUNDED_STIPEND";
      else if (benefits.includes("tuition")) data.fundingType = "FULLY_FUNDED";
    }

    const levels = parseLevels(d);
    if (levels.length && (rec.studyLevels || "[]") === "[]") data.studyLevels = JSON.stringify(levels);

    const lang = parseLanguage(d);
    if (lang && (rec.languageRequirements || "[]") === "[]") data.languageRequirements = JSON.stringify(lang);

    const dl = parseDeadline(d);
    if (dl && !rec.deadline) {
      const parsed = new Date(dl);
      if (!isNaN(parsed.getTime())) data.deadline = parsed;
    }

    const elig = parseEligibility(d);
    if (elig && !rec.academicRequirements) data.academicRequirements = elig;

    if (Object.keys(data).length) updates.push(prisma.scholarship.update({ where: { id: rec.id }, data }));
  }
  console.log(`updates: ${updates.length}/${records.length}`);

  if (DRY_RUN) {
    console.log("dry run — no writes");
    await prisma.$disconnect();
    return;
  }
  for (const u of updates) await u;
  await prisma.$disconnect();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
