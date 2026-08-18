/**
 * Bulk-approve PENDING scholarship records (the chinesescholarshipcouncil
 * batch that entered the moderation queue on import). Records whose deadline
 * has already passed become EXPIRED instead of ACTIVE — same rule the rest of
 * the catalogue follows. JOB listings are left untouched (they're managed
 * separately).
 *
 * Usage:
 *   npx tsx scripts/approve-pending.ts --dry-run
 *   npx tsx scripts/approve-pending.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const pending = await prisma.scholarship.findMany({
    where: { status: "PENDING", recordType: "SCHOLARSHIP" },
    select: { id: true, title: true, deadline: true },
  });
  console.log(`PENDING scholarships found: ${pending.length}`);

  const now = new Date();
  const expired = pending.filter((p) => p.deadline && p.deadline < now);
  const active = pending.filter((p) => !p.deadline || p.deadline >= now);
  console.log(`  → would ACTIVE: ${active.length}`);
  console.log(`  → would EXPIRED (past deadline): ${expired.length}`);

  if (dryRun) return;

  if (active.length) {
    const r = await prisma.scholarship.updateMany({
      where: { id: { in: active.map((p) => p.id) } },
      data: { status: "ACTIVE" },
    });
    console.log(`  ACTIVE applied: ${r.count}`);
  }
  if (expired.length) {
    const r = await prisma.scholarship.updateMany({
      where: { id: { in: expired.map((p) => p.id) } },
      data: { status: "EXPIRED" },
    });
    console.log(`  EXPIRED applied: ${r.count}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
