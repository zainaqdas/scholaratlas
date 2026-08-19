// Verified data corrections from the 2026-08-19 end-to-end audit.
// 1. EXPIRED records whose deadline is in the future → ACTIVE (open, but hidden).
// 2. Exact duplicate pair (same title+provider) → keep the correctly-sourced row.
// 3. studyLevels stored as display names → normalize to slugs.
// 4. benefits 'visa'/'housing'/'travel' → canonical keys.
// 5. officialUrls with leading/trailing whitespace → trim.
import { prisma } from "../src/lib/prisma";
import { parseJSON } from "../src/lib/scholarship";

const LEVEL_MAP: Record<string, string> = { "undergraduate": "undergraduate", "phd": "phd", "master's": "masters" };
const BENEFIT_MAP: Record<string, string> = { visa: "visaSupport", housing: "accommodation", travel: "airfare" };

async function main() {
  const now = new Date();

  // 1. EXPIRED with future deadline → ACTIVE
  const staleExpired = await prisma.scholarship.findMany({
    where: { status: "EXPIRED", deadline: { gt: now } },
    select: { id: true, title: true, deadline: true },
  });
  console.log(`[1] EXPIRED with future deadline: ${staleExpired.length}`);
  for (const s of staleExpired) {
    await prisma.scholarship.update({ where: { id: s.id }, data: { status: "ACTIVE", updatedAt: now } });
    console.log(`    → ACTIVE: ${s.title.slice(0, 60)}`);
  }

  // 2. Duplicate pair — keep the row whose sourceUrl matches its own title.
  const dups = await prisma.scholarship.findMany({
    where: {
      title: "Global Awareness Study Abroad Fund at Stetson University 2026",
      provider: "University of East London Northeastern University",
    },
    select: { id: true, title: true, sourceUrl: true },
  });
  console.log(`[2] duplicate pair rows: ${dups.length}`);
  for (const d of dups) {
    const sourceMatches = d.sourceUrl?.includes("global-awareness");
    console.log(`    ${d.id} sourceMatches=${sourceMatches} ${d.sourceUrl?.slice(0, 70)}`);
    if (sourceMatches) {
      console.log("    keeping (source matches title)");
    } else {
      await prisma.scholarship.delete({ where: { id: d.id } });
      console.log("    deleted (sourceUrl belongs to a different listing)");
    }
  }

  // 3 + 4. Normalize studyLevels / benefits across all records (small sets).
  const all = await prisma.scholarship.findMany({
    select: { id: true, studyLevels: true, benefits: true, officialUrl: true },
  });
  let levelFixed = 0;
  let benefitFixed = 0;
  let urlTrimmed = 0;
  for (const r of all) {
    const updates: Record<string, string> = {};

    const levels = parseJSON<string[]>(r.studyLevels, []);
    const newLevels = levels.map((l) => LEVEL_MAP[l.toLowerCase()] ?? l);
    if (newLevels.join("|") !== levels.join("|")) {
      updates.studyLevels = JSON.stringify(newLevels);
      levelFixed++;
    }

    const benefits = parseJSON<string[]>(r.benefits, []);
    const newBenefits = benefits.map((b) => BENEFIT_MAP[b] ?? b);
    if (newBenefits.join("|") !== benefits.join("|")) {
      updates.benefits = JSON.stringify(newBenefits);
      benefitFixed++;
    }

    if (r.officialUrl && r.officialUrl !== r.officialUrl.trim()) {
      updates.officialUrl = r.officialUrl.trim();
      urlTrimmed++;
    }

    if (Object.keys(updates).length) {
      await prisma.scholarship.update({ where: { id: r.id }, data: updates });
    }
  }
  console.log(`[3] studyLevels normalized: ${levelFixed}`);
  console.log(`[4] benefits normalized: ${benefitFixed}`);
  console.log(`[5] officialUrls trimmed: ${urlTrimmed}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
