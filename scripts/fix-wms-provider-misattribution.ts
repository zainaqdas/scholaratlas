// Fix: records whose provider is the mangled "University of East London
// Northeastern University".
//
// A university-matching backfill assigned this merged name (a bad fuzzy match
// concatenating two universities) to 56 wemakescholars records spanning Duke,
// Stetson, Monash, DAAD, Qatar Airways, British Council and more. For 44 of
// them a correct-provider copy of the same sourceUrl already exists elsewhere
// in the catalogue → the wrong copy is deleted (cascades handle saved/reports,
// matching the repo's dedupe convention). The remaining 12 are the only copy
// → their provider is corrected to the title-derived entity via an explicit,
// reviewable map below.
//
// Usage:
//   npm run fix:wms-provider-misattribution -- --dry-run
//   npm run fix:wms-provider-misattribution
import { prisma } from "../src/lib/prisma";

const BAD_PROVIDER = "University of East London Northeastern University";

// Explicit id → correct provider for the 12 unique records (title-derived).
// Verified against catalogue conventions where they exist (e.g. "British
// Council", "German Academic Exchange Service (DAAD)", "Scottish Government").
const PROVIDER_FIXES: Record<string, string> = {
  cmsyzutwu0005c49pzdm7spk4: "Education Future", // Education Future International Scholarship
  cmsyzv47m0015c49pm01yneay: "British Council", // British Council IELTS Award
  cmsyzv5b40019c49p1l12htfb: "Guangdong Provincial Government", // Guangdong Government Outstanding Foreign Student Scholarships
  cmsyzv5wg001bc49pk7tks73r: "Qatar Airways", // Qatar Airways National Scholarships
  cmsyzv6fp001dc49pa4f4nb94: "Bank of Canada", // Master's Award for Women in Economics and Finance
  cmsyzv6yv001fc49pvjdk5j1x: "American Bar Foundation", // ABF Doctoral Fellowships
  cmsyzv8ij001lc49pt93joigw: "Reserve Bank of India", // RBI Scholarship Scheme
  cmsyzv92p001nc49pvk0i85bw: "Government of Poland", // Government of Poland Scholarship
  cmsyzv9vk001pc49plgl4vc64: "Scottish Government", // Scotland Pakistan Scholarships
  cmsyzvah4001rc49poqw1iv7t: "French Embassy in the Philippines", // PhilFrance Master Scholarships
  cmsyzvfyu002bc49p0mqsws27: "Fulbright Commission", // Fulbright - Falcone - NIAF Scholarship
  cmsyzvhjc002hc49pj9h2krsh: "German Academic Exchange Service (DAAD)", // DAAD Bi-national Doctoral Degrees
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const rows = await prisma.scholarship.findMany({
    where: { provider: BAD_PROVIDER },
    select: { id: true, title: true, sourceUrl: true, status: true },
  });
  console.log(`records with bad provider: ${rows.length}`);

  const toDelete: string[] = [];
  const toFix: { id: string; from: string; to: string }[] = [];
  const unmapped: string[] = [];

  for (const r of rows) {
    const others = await prisma.scholarship.count({
      where: { sourceUrl: r.sourceUrl, provider: { not: BAD_PROVIDER } },
    });
    if (others > 0) {
      toDelete.push(r.id);
    } else if (PROVIDER_FIXES[r.id]) {
      toFix.push({ id: r.id, from: BAD_PROVIDER, to: PROVIDER_FIXES[r.id] });
    } else {
      unmapped.push(r.id);
    }
  }

  console.log(`  duplicate copies to delete: ${toDelete.length}`);
  console.log(`  unique records to re-provide: ${toFix.length}`);
  for (const f of toFix) console.log(`    ${f.id} -> ${f.to}`);
  if (unmapped.length) console.log(`  UNMAPPED (need attention): ${unmapped.length}`);

  if (dryRun) {
    console.log("\n(dry-run — no writes)");
    await prisma.$disconnect();
    return;
  }

  if (toDelete.length) {
    const del = await prisma.scholarship.deleteMany({ where: { id: { in: toDelete }, provider: BAD_PROVIDER } });
    console.log(`\nDeleted ${del.count} duplicate copies`);
  }
  if (toFix.length) {
    for (const f of toFix) {
      const upd = await prisma.scholarship.updateMany({
        where: { id: f.id, provider: BAD_PROVIDER },
        data: { provider: f.to, updatedAt: new Date() },
      });
      if (!upd.count) console.warn(`  ! no row updated for ${f.id}`);
    }
    console.log(`Updated ${toFix.length} unique records with correct providers`);
  }

  const remaining = await prisma.scholarship.count({ where: { provider: BAD_PROVIDER } });
  console.log(`Remaining bad-provider records: ${remaining}`);
  if (remaining) {
    const left = await prisma.scholarship.findMany({ where: { provider: BAD_PROVIDER }, select: { id: true, title: true } });
    for (const l of left) console.log(`  UNMAPPED: ${l.id} | ${l.title.slice(0, 60)}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
