import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/utils";

// ---------------------------------------------------------------------------
// Remaining Chinese medical colleges from faculty_data_all.xlsx that had no
// University record and no scholarships. All are CSC-designated institutions
// hosting international students; each gets a standard Chinese Government
// Scholarship (CSC) record — same terms and UNVERIFIED status as the 262 CSC
// records already in the catalogue. Zhongshan School of Medicine is excluded
// (it is the medical school of Sun Yat-sen University, not a separate host).
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

const COLLEGES: { name: string; city: string; notes: string }[] = [
  { name: "Guizhou Medical University", city: "Guiyang", notes: "Provincial key medical university (Guizhou)." },
  { name: "Hainan Medical University", city: "Haikou", notes: "Hainan Province's main medical university." },
  { name: "North Sichuan Medical College", city: "Nanchong", notes: "Sichuan provincial medical college." },
  { name: "Shandong First Medical University", city: "Jinan / Tai'an", notes: "Merged with Shandong Academy of Medical Sciences." },
  { name: "Shanxi Medical University", city: "Taiyuan", notes: "Shanxi Province's key medical university." },
  { name: "Shenyang Medical College", city: "Shenyang", notes: "Liaoning provincial medical college." },
  { name: "Wannan Medical College", city: "Wuhu", notes: "Anhui provincial medical college." },
  { name: "Baotou Medical College", city: "Baotou", notes: "Inner Mongolia medical college." },
  { name: "Binzhou Medical University", city: "Yantai / Binzhou", notes: "Shandong provincial medical university." },
  { name: "Chengdu Medical College", city: "Chengdu", notes: "Sichuan provincial medical college." },
  { name: "Gannan Medical University", city: "Ganzhou", notes: "Jiangxi provincial medical university." },
  { name: "Jining Medical University", city: "Jining", notes: "Shandong provincial medical university." },
  { name: "Qiqihar Medical University", city: "Qiqihar", notes: "Heilongjiang provincial medical university." },
  { name: "Shandong Second Medical University", city: "Weifang", notes: "Shandong provincial medical university." },
  { name: "Xinxiang Medical University", city: "Xinxiang", notes: "Henan provincial medical university." },
  { name: "Youjiang Medical University for Nationalities", city: "Baise", notes: "Guangxi medical university for ethnic minorities." },
  { name: "Zunyi Medical University", city: "Zunyi", notes: "Guizhou provincial medical university." },
];

const CSC_DESC =
  "The Chinese Government Scholarship (CSC) covers tuition, on-campus accommodation, a monthly living allowance " +
  "(2,500 RMB for undergraduates, 3,000 RMB for master's, 3,500 RMB for doctoral students) and comprehensive " +
  "medical insurance for international students. {notes}";

async function main() {
  const existing = await prisma.university.findMany({
    where: { countryCode: "CN" },
    select: { id: true, name: true },
  });
  const byLower = new Map(existing.map((u) => [u.name.toLowerCase(), u.id]));

  const plans = COLLEGES.map((c) => {
    const uniId = byLower.get(c.name.toLowerCase());
    return {
      ...c,
      uniId,
      scholarshipTitle: `${c.name} Chinese Government Scholarship`,
      slug: slugify(`${c.name} Chinese Government Scholarship`),
    };
  });

  console.log("Plan:");
  for (const p of plans) {
    console.log(`  ${p.uniId ? "EXISTS" : "CREATE"} ${p.name} -> ${p.scholarshipTitle}`);
  }

  if (DRY_RUN) {
    console.log("[dry-run] no changes made.");
    return;
  }

  for (const p of plans) {
    // 1. University record (if missing)
    let uniId = p.uniId;
    if (!uniId) {
      const created = await prisma.university.create({
        data: { name: p.name, slug: slugify(p.name), countryCode: "CN", city: p.city },
        select: { id: true },
      });
      uniId = created.id;
      console.log(`  ✓ created university ${p.name}`);
    }

    // 2. Scholarship (skip if title already exists)
    const exists = await prisma.scholarship.findFirst({
      where: { slug: p.slug },
      select: { id: true },
    });
    if (exists) {
      console.log(`  ~ already present: ${p.scholarshipTitle}`);
      continue;
    }

    await prisma.scholarship.create({
      data: {
        title: p.scholarshipTitle,
        slug: p.slug,
        description: CSC_DESC.replace("{notes}", p.notes),
        provider: "China Scholarship Council (CSC)",
        providerType: "GOVERNMENT",
        universityId: uniId,
        countryCode: "CN",
        studyLevels: JSON.stringify(["undergraduate", "masters", "phd"]),
        fields: JSON.stringify(["medicine", "nursing", "public-health", "pharmacy"]),
        eligibleNationalities: JSON.stringify(["ALL"]),
        fundingType: "FULLY_FUNDED",
        benefits: JSON.stringify(["TUITION", "ACCOMMODATION", "STIPEND", "INSURANCE"]),
        amount: "Monthly allowance: 2,500 RMB (UG) · 3,000 RMB (Masters) · 3,500 RMB (PhD)",
        languageRequirements: JSON.stringify({}),
        requiredDocuments: JSON.stringify([]),
        applicationSteps: JSON.stringify([]),
        officialUrl: "https://studyinchina.csc.edu.cn/",
        sourceUrl: "https://studyinchina.csc.edu.cn/",
        recordType: "SCHOLARSHIP",
        verificationStatus: "UNVERIFIED",
        status: "ACTIVE",
        submittedNote: `Curated standard CSC record for ${p.name} on ${new Date().toISOString().slice(0, 10)} (unverified — pending admin review)`,
      },
    });
    console.log(`  ✓ created scholarship ${p.scholarshipTitle}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

main()
  .catch((err) => {
    console.error("Import failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
