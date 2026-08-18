/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// Rebuild statuses: replicate the live catalogue's moderation state after a
// fresh import. Importers write PENDING/UNVERIFIED by design (nothing public
// until an admin reviews). The live DB had every imported record approved:
//   - SCHOLARSHIP records: PENDING -> ACTIVE (the user approved the backlog)
//   - deadline in the past -> EXPIRED (kept for history/SEO, shown "Closed")
//   - JOB records (EURAXESS): left PENDING, they are admin-only by design
//
// Usage: npx tsx scripts/rebuild-statuses.ts [--dry-run]
// ---------------------------------------------------------------------------

import { prisma } from "../src/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const now = new Date();

  // 1. Approve every PENDING scholarship record (not JOBs).
  const pendingScholarships = await prisma.scholarship.count({
    where: { recordType: "SCHOLARSHIP", status: "PENDING" },
  });
  console.log(`PENDING scholarship records to approve: ${pendingScholarships}`);

  // 2. Expire ACTIVE records whose deadline has passed.
  const expiring = await prisma.scholarship.count({
    where: { recordType: "SCHOLARSHIP", status: "ACTIVE", deadline: { lt: now } },
  });
  console.log(`ACTIVE records with past deadlines (-> EXPIRED): ${expiring}`);

  if (DRY_RUN) {
    console.log("[dry-run] no writes.");
    return;
  }

  const approve = await prisma.scholarship.updateMany({
    where: { recordType: "SCHOLARSHIP", status: "PENDING" },
    data: { status: "ACTIVE" },
  });
  console.log(`Approved to ACTIVE: ${approve.count}`);

  const expire = await prisma.scholarship.updateMany({
    where: { recordType: "SCHOLARSHIP", status: "ACTIVE", deadline: { lt: now } },
    data: { status: "EXPIRED" },
  });
  console.log(`Marked EXPIRED: ${expire.count}`);

  const jobs = await prisma.scholarship.count({ where: { recordType: "JOB" } });
  console.log(`JOB records left as-is (admin-only): ${jobs}`);

  const byStatus = await prisma.scholarship.groupBy({ by: ["status"], _count: true });
  console.log("Final by status:", JSON.stringify(byStatus));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
