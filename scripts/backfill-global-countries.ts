/**
 * Backfill `hostCountries` for global / multi-country scholarships and promote
 * the two records whose source names a single unambiguous host country out of
 * the global bucket (they get a real `countryCode` instead).
 *
 * DATA-INTEGRITY RULE: every assignment is keyed by exact slug and cites the
 * source line it came from. Nothing is inferred from "any university around the
 * world" phrasing — records whose sources name no specific countries stay
 * countryless (displayed as "Multiple countries" with an empty list).
 *
 * Evidence sources (all from the record's own stored description, which came
 * verbatim from the source pages):
 *
 *   searca-graduate-scholarships…  "Institut Pertanian Bogor (IPB), Bogor, Indonesia •
 *                                   Universitas Gadjah Mada (UGM), Yogyakarta, Indonesia •
 *                                   Universiti Putra Malaysia (UPM), Selangor, Malaysia •
 *                                   Kasetsart University (KU), Bangkok, Thailand •
 *                                   University of the Philippines Los Baños (UPLB), Laguna, Philippines"
 *   peo-international-peace…        "Accredited Universities and Colleges in United States or Canada"
 *   friedrich-naumann-foundation…   "German, Swiss and other EU state or state-recognized universities"
 *   vlir-uos-training…              "Participating Academic Institutions and Universities in Belgium"
 *   edx-free-online-courses-s4d     "60+ participating Universities which include Harvard University,
 *                                   MIT, UC Berkeley, McGill University, Australian National University,
 *                                   Wellesley, Georgetown, University of Toronto, TU Delft, and The
 *                                   University of Texas System"  → US, CA, AU, NL
 *   adb-internship-program-s4d      "Asian Development Bank Headquarters, Manila, Philippines or
 *                                   ADB Field Offices"  → PH named; field offices not enumerated
 *   world-bank-internships-s4d      "World Bank in Washington DC, USA"  → single host → countryCode US
 *   sgu-commonwealth…               "St. George's University in Grenada"  → single host → countryCode GD
 */

import { prisma } from "../src/lib/prisma";

const MULTI: Record<string, string[]> = {
  // [host country codes]
  "searca-graduate-scholarships-in-agriculture-for-southeast-asians-s4d": ["ID", "MY", "TH", "PH"],
  "peo-international-peace-scholarships-for-women-s4d": ["US", "CA"],
  "friedrich-naumann-foundation-scholarship-for-international-students-s4d": ["DE", "CH"],
  "vlir-uos-training-scholarships-for-developing-countries-s4d": ["BE"],
  "edx-free-online-courses-s4d": ["US", "CA", "AU", "NL"],
  "adb-internship-program-s4d": ["PH"],
};

// Single unambiguous host country → promote out of the global bucket.
const SINGLE: Record<string, string> = {
  "world-bank-internships-s4d": "US",
  "sgu-commonwealth-jubilee-scholarship-program-s4d": "GD",
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  let updated = 0;

  for (const [slug, codes] of Object.entries(MULTI)) {
    const found = await prisma.scholarship.findUnique({ where: { slug } });
    if (!found) {
      console.log(`  MISSING (skip): ${slug}`);
      continue;
    }
    const stored = JSON.stringify(codes);
    if (found.hostCountries === stored) {
      console.log(`  ok (already set): ${slug}`);
      continue;
    }
    if (!dryRun) await prisma.scholarship.update({ where: { slug }, data: { hostCountries: stored } });
    console.log(`  ${dryRun ? "[dry] would set" : "set"} hostCountries ${stored} ← ${slug}`);
    updated++;
  }

  for (const [slug, code] of Object.entries(SINGLE)) {
    const found = await prisma.scholarship.findUnique({ where: { slug } });
    if (!found) {
      console.log(`  MISSING (skip): ${slug}`);
      continue;
    }
    if (found.countryCode === code) {
      console.log(`  ok (already promoted): ${slug} → ${code}`);
      continue;
    }
    if (!dryRun) {
      await prisma.scholarship.update({
        where: { slug },
        data: { countryCode: code, hostCountries: "[]" },
      });
    }
    console.log(`  ${dryRun ? "[dry] would promote" : "promoted"} ${slug} → countryCode ${code}`);
    updated++;
  }

  console.log(`\nDone. ${dryRun ? "(dry run) " : ""}${updated} record(s) would be/were touched.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
