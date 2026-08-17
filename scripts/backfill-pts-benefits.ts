/* Backfill benefits + fundingType for PathwaysToScience records from their
 * description text (data/pts-details.jsonl).
 *
 * PTS descriptions are free text that often list what a program provides:
 *   - "a 10-week PAID summer undergraduate research program"
 *   - "Scholars receive a $4,000 stipend, plus room and board"
 *   - "full-tuition scholarships"
 *   - "health insurance (including dental and vision)"
 *
 * Only context-aware, positive-framing matches are counted (the program
 * provides/offers/includes X) so boilerplate like "manned space flight" or
 * "accessible housing" doesn't create false benefits.
 *
 * Usage:
 *   npx tsx scripts/backfill-pts-benefits.ts --dry-run
 *   npx tsx scripts/backfill-pts-benefits.ts
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

type BenefitRule = { key: string; pat: RegExp };
const BENEFIT_RULES: BenefitRule[] = [
  // stipend: payment / salary / stipend / paid program
  { key: "stipend", pat: /\b(stipend|salary)\b|(\$\s?\d[\d,.]*\s*(?:per\s*)?(?:week|month|year|semester|summer)|hourly (?:rate|pay)\s+of\s+\$|paid (?:summer|undergraduate|research|internship|intern))/i },
  // accommodation: housing / room and board / dorm
  { key: "accommodation", pat: /\broom and board\b|\broom & board\b|on-campus housing|\bhousing (?:is )?(?:provided|included|covered)|(?:free|fully[- ])?housing (?:and|for)|dormitory (?:room|accommodation)|housing allowance/i },
  // airfare: travel allowance / travel support / airfare
  { key: "airfare", pat: /\bairfare\b|travel (?:allowance|support|grant|expenses?|stipend)|round[- ]trip (?:airfare|travel|flight)|(?:paid|reimbursed)\s+travel/i },
  // tuition: full tuition / tuition waiver / course credit
  { key: "tuition", pat: /full[- ]tuition|tuition (?:waiver|waived|covered|scholarship|remission)|free tuition|tuition[- ]free|(?:covers?|includes?|pays?)\s+tuition/i },
  // insurance: health insurance provided/included
  { key: "insurance", pat: /health insurance|medical (?:insurance|coverage)|insurance (?:is )?(?:provided|included|covered)|insurance benefits/i },
];

// Extract a stipend amount when the text states one explicitly.
function extractAmount(desc: string): string | null {
  const m = desc.match(
    /(?:stipend|salary|award)\s+(?:of|starting at|totaling|is)\s+\$\s?[\d][\d,.]*|\$\s?[\d][\d,.]*\s+(?:per\s*)?(?:week|month|year|semester|summer)|stipend\s+(?:of|starting at|totaling|is)\s+[\d][\d,.]*/i
  );
  if (!m) return null;
  const raw = m[0].trim();
  if (!/\d/.test(raw)) return null;
  return raw.replace(/\s+/g, " ");
}

function parseBenefits(desc: string): { benefits: string[]; fundingType: string; amount: string | null } {
  const t = desc.toLowerCase();
  const benefits: string[] = [];
  for (const { key, pat } of BENEFIT_RULES) {
    if (pat.test(t)) benefits.push(key);
  }
  let fundingType = "PARTIAL";
  if (benefits.includes("tuition") && (benefits.includes("stipend") || benefits.includes("accommodation"))) {
    fundingType = "FULLY_FUNDED_STIPEND";
  } else if (benefits.includes("tuition") && benefits.includes("stipend")) {
    fundingType = "FULLY_FUNDED_STIPEND";
  } else if (benefits.includes("tuition")) {
    fundingType = "FULLY_FUNDED";
  } else if (benefits.includes("stipend")) {
    fundingType = "FULLY_FUNDED";
  }
  return { benefits, fundingType, amount: extractAmount(desc) };
}

async function main() {
  const rows: { sourceUrl: string; description?: string | null }[] = [];
  try {
    for (const line of readFileSync("data/pts-details.jsonl", "utf8").split("\n")) {
      if (!line.trim()) continue;
      rows.push(JSON.parse(line) as { sourceUrl: string; description?: string | null });
    }
  } catch {
    console.error("Could not read data/pts-details.jsonl — aborting.");
    process.exit(1);
  }
  console.log(`pts descriptions loaded: ${rows.length}`);

  const byUrl = new Map<string, string>();
  for (const r of rows) {
    if (r.sourceUrl) byUrl.set(r.sourceUrl, r.description || "");
  }

  const records = await prisma.scholarship.findMany({
    where: { status: "ACTIVE", recordType: "SCHOLARSHIP", sourceUrl: { contains: "pathwaystoscience" } },
    select: { id: true, sourceUrl: true, benefits: true, fundingType: true },
  });
  console.log(`PTS records in DB: ${records.length}`);

  const updates: { id: string; benefits: string[]; fundingType: string; amount?: string | null }[] = [];
  for (const rec of records) {
    const desc = rec.sourceUrl ? byUrl.get(rec.sourceUrl) : undefined;
    if (!desc) continue;
    const { benefits, fundingType, amount } = parseBenefits(desc);
    if (benefits.length || amount) updates.push({ id: rec.id, benefits, fundingType, amount });
  }
  console.log(`classifiable: ${updates.length}/${records.length}`);

  if (DRY_RUN) {
    console.log("dry run — no writes");
    await prisma.$disconnect();
    return;
  }

  const CHUNK = 100;
  let done = 0;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const batch = updates.slice(i, i + CHUNK);
    await prisma.$transaction(
      batch.map((u) =>
        prisma.scholarship.update({
          where: { id: u.id },
          data: {
            benefits: JSON.stringify(u.benefits),
            fundingType: u.fundingType,
            ...(u.amount ? { amount: u.amount, currency: "USD" } : {}),
          },
        })
      )
    );
    done += batch.length;
    if (done % 300 === 0 || done === updates.length) console.log(`applied ${done}/${updates.length}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
