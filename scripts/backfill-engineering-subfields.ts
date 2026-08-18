// Backfill: refine ACTIVE records already tagged "engineering" with a
// sub-discipline slug (mechanical-engineering, civil-engineering, ...) so the
// Engineering category becomes an umbrella with drill-down sub-fields.
//
// Safety rules (learned from the medicine backfill):
// - Only records ALREADY tagged "engineering" are touched — the pool is
//   confirmed engineering, we are only refining it. Untagged records whose
//   titles contain loose terms ("marine" botany, "civil" law, "nuclear"
//   physics, "mining" as a university name) are never tagged.
// - The exact phrase "X engineering" must appear at a TOKEN start — matched
//   with (^|[\s(&])...\b so "Electromechanical Engineering" cannot match
//   "mechanical engineering" and "Subsidence-Control Engineering" cannot
//   match "control engineering".
// - Only the program part of the title (before the em-dash, when present) is
//   searched, so university names never trigger a tag.
//
// Usage: npx tsx scripts/backfill-engineering-subfields.ts [--dry-run]
import { prisma } from "../src/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

const EM_DASH = "\u2014";

// phrase -> canonical sub-discipline slug
const PHRASES: [string, string][] = [
  ["chemical engineering", "chemical-engineering"],
  ["mechanical engineering", "mechanical-engineering"],
  ["software engineering", "software-engineering"],
  ["civil engineering", "civil-engineering"],
  ["electrical engineering", "electrical-engineering"],
  ["power engineering", "power-engineering"],
  ["environmental engineering", "environmental-engineering"],
  ["control engineering", "control-engineering"],
  ["materials science and engineering", "materials-engineering"],
  ["materials engineering", "materials-engineering"],
  ["biomedical engineering", "biomedical-engineering"],
  ["petroleum engineering", "petroleum-engineering"],
  ["transportation engineering", "transportation-engineering"],
  ["industrial engineering", "industrial-engineering"],
  ["manufacturing engineering", "manufacturing-engineering"],
  ["electronic engineering", "electronic-engineering"],
  ["electronics engineering", "electronic-engineering"],
  ["computer engineering", "computer-engineering"],
  ["systems engineering", "systems-engineering"],
  ["mining engineering", "mining-engineering"],
  ["structural engineering", "structural-engineering"],
  ["automotive engineering", "automotive-engineering"],
  ["geotechnical engineering", "geotechnical-engineering"],
  ["agricultural engineering", "agricultural-engineering"],
  ["nuclear engineering", "nuclear-engineering"],
  ["energy engineering", "energy-engineering"],
  ["aeronautical engineering", "aerospace-engineering"],
  ["robotics engineering", "robotics-engineering"],
  ["telecommunication engineering", "telecommunication-engineering"],
  ["water resources engineering", "water-resources-engineering"],
];

// longest first so compound phrases win over their substrings
const SORTED = [...PHRASES].sort((a, b) => b[0].length - a[0].length);

const ALL_SUB_SLUGS = new Set(PHRASES.map(([, slug]) => slug));

function matches(subject: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s(&)])${escaped}\\b`).test(subject);
}

async function main() {
  const rows = await prisma.scholarship.findMany({
    where: { status: "ACTIVE", recordType: "SCHOLARSHIP" },
    select: { id: true, title: true, fields: true },
  });

  let tagged = 0;
  const samples: string[] = [];
  const bySlug: Record<string, number> = {};
  for (const r of rows) {
    let fieldsArr: string[] = [];
    try {
      fieldsArr = JSON.parse(r.fields) as string[];
    } catch {
      continue;
    }
    if (!fieldsArr.includes("engineering")) continue; // only refine confirmed engineering
    if (fieldsArr.some((f) => ALL_SUB_SLUGS.has(f))) continue;

    const tl = r.title.toLowerCase();
    const dashIdx = tl.indexOf(EM_DASH);
    const subject = dashIdx >= 0 ? tl.slice(0, dashIdx) : tl;

    const matched = SORTED.filter(([phrase]) => matches(subject, phrase)).map(([, slug]) => slug);
    if (!matched.length) continue;

    const unique = [...new Set(matched)];
    const next = JSON.stringify([...fieldsArr, ...unique]);
    if (next === r.fields) continue;

    if (!DRY_RUN) {
      await prisma.scholarship.update({ where: { id: r.id }, data: { fields: next } });
    }
    tagged++;
    for (const s of unique) bySlug[s] = (bySlug[s] ?? 0) + 1;
    if (samples.length < 12) samples.push(`${r.title}  ->  +${unique.join(",")}`);
  }

  console.log(`${DRY_RUN ? "[dry-run] would tag" : "tagged"}: ${tagged} records`);
  for (const s of samples) console.log("  -", s.slice(0, 110));
  console.log("\nby sub-discipline:");
  Object.entries(bySlug).sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log(`  ${s.padEnd(26)} ${n}`));
}

main().finally(() => prisma.$disconnect());
