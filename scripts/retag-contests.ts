// Move contest/prize/competition listings out of the scholarship catalogue into
// their own record type (CONTEST), mirroring how JOB listings are separated.
// No data is deleted — the records stay fully intact, they just stop appearing
// in scholarship surfaces (search, homepage, countries, fields, sitemap) and
// get their own section at /contests.
import { prisma } from "../src/lib/prisma";

// Title patterns that identify contests/prizes rather than scholarships.
// Deliberately conservative: "award" is NOT included (scholarships are often
// called awards); we only move clear contest/prize/competition wording.
const PATTERN =
  /contest|competition|compete|prize|call for project|startup|start-up|hackathon|giveaway/i;

// --dry-run: report what WOULD change and exit WITHOUT writing. Never retag a
// record without confirming the preview — the pattern is broad (it matches
// landing pages like "Scholarships, prizes and grants") and a mistake here
// silently removes real scholarships from the catalogue.
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const rows = await prisma.scholarship.findMany({
    select: { id: true, title: true, status: true, recordType: true },
  });

  const toTag = rows.filter((r) => PATTERN.test(r.title) && r.recordType !== "CONTEST");
  const byStatus: Record<string, number> = {};
  for (const r of toTag) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  console.log("records to retag as CONTEST:", toTag.length, JSON.stringify(byStatus));

  let n = 0;
  for (const r of toTag) {
    if (DRY_RUN) {
      if (n < 20) console.log(`  → ${r.title.slice(0, 70)}`);
      n++;
      continue;
    }
    await prisma.scholarship.update({
      where: { id: r.id },
      data: { recordType: "CONTEST" },
    });
    n++;
    if (n <= 5) console.log(`  → ${r.title.slice(0, 70)}`);
  }
  console.log(DRY_RUN ? `dry-run: ${n} records would become CONTEST (nothing written)` : `done: ${n} records now CONTEST`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
