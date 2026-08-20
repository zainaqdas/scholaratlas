// Fix: replace junk officialUrl values with the official CSC application portal.
//
// The cscouncil import attached the FIRST non-blocklisted href on each page as
// the "official" link. The site's Google-Translate widget CDN
// (cdn.gtranslate.net) and its ad-consent stub
// (fundingchoicesmessages.google.com) appear before any real link, so 215+
// records ended up pointing users at a broken translation widget instead of
// the scholarship source. (A re-crawl cannot recover the real links — the
// pages now carry no external hrefs at all; the "Apply Online" buttons are
// href="#" and the canonical/og links are the site itself.)
//
// These are all Chinese Government Scholarship records, and the established
// convention in this catalogue (15 records already) is
// https://studyinchina.csc.edu.cn/ — the official CSC online application
// portal. Junk values are replaced with that portal; the original aggregator
// page stays preserved in sourceUrl. A single stray non-CSC record whose
// "official link" was a google.com search URL is nulled instead (no portal
// convention applies to it).
//
// Usage:
//   npm run fix:csc-official-urls -- --dry-run
//   npm run fix:csc-official-urls
import { prisma } from "../src/lib/prisma";

const CSC_PORTAL = "https://studyinchina.csc.edu.cn/";

// Values that are never a real scholarship source.
const JUNK_PATTERNS = [
  "cdn.gtranslate.net", // Google-Translate widget CDN
  "fundingchoicesmessages.google.com", // ad-consent stub
  "www.google.com/search", // a search-results page used as a "link"
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const junk = await prisma.scholarship.findMany({
    where: { OR: JUNK_PATTERNS.map((p) => ({ officialUrl: { contains: p } })) },
    select: { id: true, title: true, provider: true, officialUrl: true },
  });
  const cscJunk = junk.filter((r) => r.provider?.includes("CSC"));
  const nonCscJunk = junk.filter((r) => !r.provider?.includes("CSC"));

  // The stray non-CSC junk (e.g. a google.com/search URL) gets nulled.
  const nullTargets = nonCscJunk.filter((r) => !/sites\.google\.com|drive\.google\.com|docs\.google\.com|edu\.google\.com/.test(r.officialUrl ?? ""));

  console.log(`Junk officialUrl records: ${junk.length}`);
  console.log(`  CSC provider → portal (${CSC_PORTAL}): ${cscJunk.length}`);
  console.log(`  non-CSC junk → null: ${nullTargets.length}`);
  for (const r of nullTargets) console.log(`    - ${r.title.slice(0, 60)} | ${r.officialUrl}`);

  if (dryRun) {
    console.log("\n(dry-run — no writes)");
    await prisma.$disconnect();
    return;
  }

  if (cscJunk.length) {
    const updated = await prisma.scholarship.updateMany({
      where: { id: { in: cscJunk.map((r) => r.id) } },
      data: { officialUrl: CSC_PORTAL },
    });
    console.log(`\nUpdated ${updated.count} CSC records → ${CSC_PORTAL}`);
  }
  if (nullTargets.length) {
    const updated = await prisma.scholarship.updateMany({
      where: { id: { in: nullTargets.map((r) => r.id) } },
      data: { officialUrl: null },
    });
    console.log(`Nulled ${updated.count} non-CSC junk records`);
  }

  const remaining = await prisma.scholarship.count({
    where: { OR: JUNK_PATTERNS.map((p) => ({ officialUrl: { contains: p } })) },
  });
  console.log(`Remaining junk officialUrls: ${remaining}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
