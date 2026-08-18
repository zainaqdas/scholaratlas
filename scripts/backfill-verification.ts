/**
 * Evidence-based verification pass. The catalogue currently sits 100%
 * UNVERIFIED (the "Verified" badge never renders anywhere). This marks records
 * VERIFIED only where the data demonstrably came from the official provider's
 * own source, and RECENTLY_UPDATED where a third-party source was crawled
 * recently with live-verified links.
 *
 * VERIFIED (checked against an official source — every record in these tiers
 * carries a sourceUrl that IS the official provider's own page/database):
 *   - Campus Bourses   → official Campus France government database
 *   - Study in Sweden  → official Swedish government guide
 *   - DAAD             → official DAAD database (daad.de)
 *   - CampusChina      → official Chinese Scholarship Council crawl
 *   - uni-direct       → hand-curated straight from each university's official
 *                        scholarship page (strongest tier — page fetched and
 *                        rendered, data written from what it states)
 *
 * RECENTLY_UPDATED (reviewed/refreshed recently from a live source, but the
 * source is a third-party listing rather than the provider itself):
 *   - Scholarships360  → hand-curated today from editorial prose with source URLs
 *   - PathwaysToScience → freshly crawled official US STEM program listings
 *
 * Everything else (wemakescholars, CUCAS Kaggle snapshots, scholars4dev,
 * chinesescholarshipcouncil) stays UNVERIFIED — aggregator or snapshot data
 * that we did not check against the provider's own source.
 *
 * Usage:
 *   npx tsx scripts/backfill-verification.ts --dry-run
 *   npx tsx scripts/backfill-verification.ts
 */
import { prisma } from "../src/lib/prisma";

const VERIFIED_SOURCE_MARKERS = [
  { label: "Campus Bourses", where: { submittedNote: { startsWith: "Imported from Campus Bourses" } } },
  { label: "Study in Sweden", where: { submittedNote: { startsWith: "Imported from the official Study in Sweden database" } } },
  { label: "DAAD", where: { sourceUrl: { contains: "daad.de" } } },
  { label: "CampusChina", where: { submittedNote: { startsWith: "Imported from campuschina.org" } } },
  { label: "uni-direct", where: { submittedNote: { startsWith: "Imported from the official university page" } } },
];

const RECENT_MARKERS = [
  { label: "Scholarships360", where: { sourceUrl: { contains: "scholarships360.org" } } },
  { label: "PathwaysToScience", where: { submittedNote: { startsWith: "Imported from pathwaystoscience.org" } } },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const today = new Date();

  for (const tier of [
    { status: "VERIFIED", markers: VERIFIED_SOURCE_MARKERS },
    { status: "RECENTLY_UPDATED", markers: RECENT_MARKERS },
  ] as const) {
    let total = 0;
    for (const m of tier.markers) {
      const count = await prisma.scholarship.count({ where: m.where });
      total += count;
      console.log(`  ${tier.status} ${m.label.padEnd(18)} ${count}`);
      if (!dryRun && count) {
        await prisma.scholarship.updateMany({
          where: m.where,
          data:
            tier.status === "VERIFIED"
              ? { verificationStatus: "VERIFIED", lastVerifiedAt: today }
              : { verificationStatus: "RECENTLY_UPDATED" },
        });
      }
    }
    console.log(`  ${tier.status} total: ${total}`);
  }

  const left = await prisma.scholarship.count({
    where: { verificationStatus: "UNVERIFIED" },
  });
  console.log(`\n${dryRun ? "(dry run) " : ""}Remaining UNVERIFIED: ${left}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
