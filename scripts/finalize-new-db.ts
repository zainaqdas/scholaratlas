/**
 * finalize-new-db.ts
 *
 * Final steps for the migrated database:
 *  1. Create University records from distinct providers/countries in crawl data
 *  2. Link scholarships to university records by normalized name
 *  3. Approve all PENDING scholarships → ACTIVE
 *
 * Usage:
 *   npx tsx scripts/finalize-new-db.ts
 */

import { prisma } from "../src/lib/prisma";

function norm(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(s: string): string {
  return norm(s).replace(/\s+/g, "-").slice(0, 100) || "university";
}

async function main() {
  // 1. Gather all distinct providers from scholarships
  const rows = await prisma.scholarship.findMany({
    where: { status: "PENDING" },
    select: { provider: true, countryCode: true },
    distinct: ["provider"],
    take: 20000,
  });
  console.log(`Distinct providers: ${rows.length}`);

  // Existing universities
  const existing = await prisma.university.findMany({ select: { name: true, id: true } });
  const existingNorm = new Map(existing.map((u) => [norm(u.name), u.id]));
  console.log(`Existing universities: ${existing.length}`);

  // 2. Create missing universities
  let created = 0;
  const providerToUni = new Map<string, string>(); // norm(provider) -> universityId
  for (const row of rows) {
    if (!row.provider) continue;
    const n = norm(row.provider);
    if (existingNorm.has(n)) {
      providerToUni.set(n, existingNorm.get(n)!);
      continue;
    }
    try {
      const uni = await prisma.university.create({
        data: {
          slug: `${slugify(row.provider)}-${Math.random().toString(36).slice(2, 7)}`,
          name: row.provider,
          countryCode: row.countryCode || "US",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      existingNorm.set(n, uni.id);
      providerToUni.set(n, uni.id);
      created++;
      if (created % 200 === 0) console.log(`  ... created ${created} universities`);
    } catch (e: any) {
      // slug collision or FK — skip
    }
  }
  console.log(`Created ${created} universities`);

  // 3. Link scholarships to universities
  let linked = 0;
  const scholarships = await prisma.scholarship.findMany({
    where: { status: "PENDING", universityId: null },
    select: { id: true, provider: true },
    take: 20000,
  });
  for (const s of scholarships) {
    if (!s.provider) continue;
    const n = norm(s.provider);
    const uniId = providerToUni.get(n) || existingNorm.get(n);
    if (uniId) {
      try {
        await prisma.scholarship.update({
          where: { id: s.id },
          data: { universityId: uniId },
        });
        linked++;
        if (linked % 1000 === 0) console.log(`  ... linked ${linked}`);
      } catch {}
    }
  }
  console.log(`Linked ${linked} scholarships to universities`);

  // 4. Approve all PENDING → ACTIVE
  const approved = await prisma.scholarship.updateMany({
    where: { status: "PENDING" },
    data: { status: "ACTIVE", verificationStatus: "VERIFIED" },
  });
  console.log(`Approved ${approved.count} scholarships to ACTIVE`);

  // 5. Totals
  const total = await prisma.scholarship.count();
  const active = await prisma.scholarship.count({ where: { status: "ACTIVE" } });
  const uniCount = await prisma.university.count();
  console.log(`\n=== FINAL STATE ===`);
  console.log(`Scholarships: ${total} (${active} ACTIVE)`);
  console.log(`Universities: ${uniCount}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
