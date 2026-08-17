/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// Correct country assignments discovered during the university backfill:
//
// 1. Universities created via the fallback (provider had no country in the
//    authoritative map) got a wrong countryCode because the fallback used
//    DISTINCT counting. Each is corrected with a verified value.
// 2. Indiana Institute of Technology records had countryCode=IN (India) —
//    "Indiana" collides with India's ISO code. The descriptions all say
//    "can be taken at Indiana Institute of Technology" (Fort Wayne, USA).
//
// Usage:
//   npm run fix:uni-countries -- --dry-run   # report only
//   npm run fix:uni-countries                # apply
// ---------------------------------------------------------------------------

import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

// Verified university countries (school's actual home country).
const UNI_FIXES: Record<string, string> = {
  "Royal Holloway, University of London (RHUL), Egham": "GB",
  "Pittsburg State University (PSU)": "US",
  "ECU South West Edith Cowan University, Bunbury": "AU",
  "ESCP Business School, London": "FR",
};

async function main() {
  // 1. University country fixes.
  for (const [name, cc] of Object.entries(UNI_FIXES)) {
    const uni = await prisma.university.findFirst({ where: { name } });
    if (!uni) {
      console.log(`SKIP (no university): ${name}`);
      continue;
    }
    if (uni.countryCode === cc) {
      console.log(`OK (already ${cc}): ${name}`);
      continue;
    }
    console.log(`${DRY_RUN ? "[dry-run] " : ""}FIX university ${name}: ${uni.countryCode} -> ${cc}`);
    if (!DRY_RUN) await prisma.university.update({ where: { id: uni.id }, data: { countryCode: cc, updatedAt: new Date() } });
  }

  // 2. Indiana Tech scholarship countryCode fix (IN -> US).
  const indiana = await prisma.scholarship.findMany({
    where: { provider: "Indiana Institute of Technology (Indiana Tech), Fort Wayne, Indiana", countryCode: "IN" },
    select: { id: true },
  });
  console.log(`${DRY_RUN ? "[dry-run] " : ""}FIX ${indiana.length} Indiana Tech scholarships: IN -> US`);
  if (!DRY_RUN) {
    const BATCH = 200;
    for (let i = 0; i < indiana.length; i += BATCH) {
      const batch = indiana.slice(i, i + BATCH);
      await prisma.$transaction(
        batch.map((r) =>
          prisma.scholarship.update({ where: { id: r.id }, data: { countryCode: "US", updatedAt: new Date() } }),
        ),
      );
    }
  }
}

main()
  .catch((err) => {
    console.error("Fix failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
