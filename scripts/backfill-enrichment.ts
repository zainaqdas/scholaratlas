// Backfill: enrich ACTIVE records that are missing `benefits`.
//
// Benefits are derived conservatively:
// - fundingType is a strong signal: FULLY_FUNDED / FULLY_FUNDED_STIPEND =>
//   tuition + stipend, TUITION_WAIVER => tuition (PARTIAL alone adds nothing).
// - Explicit benefit words in the title/description add keys (stipend,
//   accommodation, insurance, airfare, visa support, research allowance).
//
// Only records with an EMPTY benefits array are touched, and only canonical
// BENEFITS keys are written. Field enrichment is handled by
// scripts/backfill-fields.ts — keep this script benefits-only.
//
// Usage: npx tsx scripts/backfill-enrichment.ts [--dry-run]
import { prisma } from "../src/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

// Explicit benefit words -> canonical benefit key.
const BENEFIT_WORDS: [string, string][] = [
  ["stipend", "stipend"],
  ["living allowance", "stipend"],
  ["monthly allowance", "stipend"],
  ["maintenance grant", "stipend"],
  ["tuition", "tuition"],
  ["fees waiver", "tuition"],
  ["fee waiver", "tuition"],
  ["accommodation", "accommodation"],
  ["housing", "accommodation"],
  ["residence", "accommodation"],
  ["insurance", "insurance"],
  ["airfare", "airfare"],
  ["flight", "airfare"],
  ["travel allowance", "airfare"],
  ["visa", "visaSupport"],
  ["research allowance", "researchAllowance"],
  ["research grant", "researchAllowance"],
  ["conference", "researchAllowance"],
];

function deriveBenefits(fundingType: string | null, title: string, description: string): string[] {
  const out = new Set<string>();
  if (fundingType === "FULLY_FUNDED" || fundingType === "FULLY_FUNDED_STIPEND") {
    out.add("tuition");
    out.add("stipend");
  } else if (fundingType === "TUITION_WAIVER") {
    out.add("tuition");
  }
  const subject = `${title} ${description}`.toLowerCase();
  for (const [word, key] of BENEFIT_WORDS) {
    if (subject.includes(word)) out.add(key);
  }
  return [...out];
}

async function main() {
  const rows = await prisma.scholarship.findMany({
    where: { status: "ACTIVE", recordType: "SCHOLARSHIP" },
    select: { id: true, title: true, description: true, fundingType: true, benefits: true },
  });

  let tagged = 0;
  const samples: string[] = [];
  for (const r of rows) {
    let benefitsArr: string[] = [];
    try {
      benefitsArr = JSON.parse(r.benefits ?? "[]") as string[];
    } catch {
      /* keep [] */
    }
    if (benefitsArr.length > 0) continue;

    const derived = deriveBenefits(r.fundingType, r.title ?? "", r.description ?? "");
    if (!derived.length) continue;
    const next = JSON.stringify([...new Set(derived)]);
    if (next === r.benefits) continue;
    if (!DRY_RUN) {
      await prisma.scholarship.update({ where: { id: r.id }, data: { benefits: next } });
    }
    tagged++;
    if (samples.length < 12) samples.push(`${r.title?.slice(0, 60)}  ->  +${derived.join(",")}`);
  }

  console.log(`${DRY_RUN ? "[dry-run] would tag" : "tagged"}: ${tagged} records with benefits`);
  for (const s of samples) console.log("  -", s.slice(0, 110));
}

main().finally(() => prisma.$disconnect());
