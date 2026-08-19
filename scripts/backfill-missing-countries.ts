// ---------------------------------------------------------------------------
// Backfill: assign a destination country to ACTIVE scholarship records that
// have none — but ONLY when the title names a single unambiguous host country.
//
// Data-integrity rule: multi-country/global/online opportunities (Erasmus
// Mundus, VLIR-UOS, S P Jain tri-country, EdX online, "study abroad" listicles)
// deliberately stay countryless — pinning one country would be wrong.
//
// Usage:
//   npx tsx scripts/backfill-missing-countries.ts --dry-run
//   npx tsx scripts/backfill-missing-countries.ts
// ---------------------------------------------------------------------------
import { prisma } from "../src/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

// title substring (lowercased) -> country code. Only unambiguous host-country
// mentions. Each row is a distinct scholarship; the country must be the study
// destination, not an applicant nationality (e.g. "for African Women" is NOT a
// destination).
const RULES: [string, string][] = [
  ["visit scotland’s university", "GB"],
  ["scotland’s university of str", "GB"],
  ["quality british education from a prestigious, modern uk university", "GB"],
  ["finland scholarships for foreign students", "FI"],
  ["novo nordisk in denmark", "DK"],
  ["norway tuition free universities and scholarships", "NO"],
  ["scholarships in germany for international students", "DE"],
  ["at estonian business", "EE"],
  ["the new school in new york city", "US"],
  ["swedish student life with linnaeus university", "SE"],
];

async function main() {
  const records = await prisma.scholarship.findMany({
    where: { status: "ACTIVE", recordType: "SCHOLARSHIP", countryCode: null },
    select: { id: true, title: true, sourceUrl: true },
  });
  console.log(`records without country: ${records.length}`);

  const updates: { id: string; code: string }[] = [];
  for (const rec of records) {
    const t = (rec.title || "").toLowerCase();
    const hit = RULES.find(([needle]) => t.includes(needle));
    if (hit) updates.push({ id: rec.id, code: hit[1] });
  }
  console.log(`assignable (single host country in title): ${updates.length}`);

  if (DRY_RUN) {
    for (const u of updates) {
      const rec = records.find((r) => r.id === u.id);
      console.log(`  [dry-run] ${u.code} <- ${(rec?.title || "").slice(0, 80)}`);
    }
    await prisma.$disconnect();
    return;
  }

  let applied = 0;
  for (const u of updates) {
    await prisma.scholarship.update({ where: { id: u.id }, data: { countryCode: u.code } });
    applied++;
  }
  console.log(`applied ${applied}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
