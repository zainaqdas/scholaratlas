/**
 * import-gap-sa.ts — Saudi Arabia gap-fill (official sources only).
 *
 * Records curated from official university pages crawled in the gap sweep:
 *   - KAUST: https://www.kaust.edu.sa/en/study (Master's/PhD fully funded,
 *     Global Postdoctoral Fellowship listed on official study page)
 *   - KFUPM: https://kfupm.edu.sa/study/international-students/fees-and-scholarships
 *     (verified text: "tuition fees are waived", "full scholarship", monthly
 *     stipend, free furnished dorms, RA-MS/RA-PhD)
 *
 * These are REAL named programs with verified official-source benefits. The
 * crawler's auto-extracted lines were too noisy (news snippets), so records
 * are curated here from the saved page text (data/uni_crawl/pages/).
 */
import { prisma } from "../src/lib/prisma";

const RECORDS: {
  title: string;
  provider: string;
  countryCode: string;
  levels: string[];
  fundingType: string;
  description: string;
  officialUrl: string;
  sourceUrl: string;
}[] = [
  {
    title: "KAUST Fellowship (Master's and PhD)",
    provider: "King Abdullah University of Science and Technology",
    countryCode: "SA",
    levels: ["masters", "phd"],
    fundingType: "FULLY_FUNDED",
    description:
      "KAUST offers full scholarships for its Master's and PhD programs across Biological/Environmental, Computer/Electrical/Math, and Physical Science & Engineering divisions. The fellowship covers full tuition, a monthly stipend, on-campus housing, medical insurance, and relocation support.",
    officialUrl: "https://www.kaust.edu.sa/en/study",
    sourceUrl: "https://www.kaust.edu.sa/en/study",
  },
  {
    title: "KAUST Global Postdoctoral Fellowship",
    provider: "King Abdullah University of Science and Technology",
    countryCode: "SA",
    levels: ["phd"],
    fundingType: "FULLY_FUNDED",
    description:
      "The Global Postdoctoral Fellowship supports early-career researchers at KAUST with full funding for postdoctoral research across KAUST's science and engineering divisions.",
    officialUrl: "https://www.kaust.edu.sa/en/study",
    sourceUrl: "https://www.kaust.edu.sa/en/study",
  },
  {
    title: "KFUPM Full Scholarship for International Students (MS/PhD)",
    provider: "King Fahd University of Petroleum and Minerals",
    countryCode: "SA",
    levels: ["masters", "phd"],
    fundingType: "FULLY_FUNDED",
    description:
      "International students at KFUPM receive a full scholarship: tuition fees are waived, with a monthly stipend (based on scholarship category), free furnished on-campus housing, and the opportunity to work as a Research Assistant (RA-MS/RA-PhD) on funded projects. Available for all PhD programs and select MS programs.",
    officialUrl: "https://kfupm.edu.sa/study/international-students/fees-and-scholarships",
    sourceUrl: "https://kfupm.edu.sa/study/international-students/fees-and-scholarships",
  },
];

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

async function main() {
  // Ensure university records exist for the two providers.
  for (const prov of ["King Abdullah University of Science and Technology", "King Fahd University of Petroleum and Minerals"]) {
    const existing = await prisma.university.findFirst({ where: { name: prov } });
    if (!existing) {
      const slugBase = slugify(prov);
      const slug = `${slugBase}-${Math.random().toString(36).slice(2, 7)}`;
      await prisma.university.create({
        data: {
          slug,
          name: prov,
          countryCode: "SA",
          city: prov.includes("Petroleum") ? "Dhahran" : "Thuwal",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      console.log(`Created university: ${prov}`);
    }
  }

  let created = 0, skipped = 0;
  for (const rec of RECORDS) {
    const slug = slugify(rec.title);
    const existing = await prisma.scholarship.findUnique({ where: { slug } });
    if (existing) {
      skipped++;
      console.log(`SKIP (exists): ${rec.title}`);
      continue;
    }
    const uni = await prisma.university.findFirst({ where: { name: rec.provider } });
    await prisma.scholarship.create({
      data: {
        slug,
        title: rec.title,
        provider: rec.provider,
        providerType: "UNIVERSITY",
        countryCode: rec.countryCode,
        universityId: uni?.id,
        description: rec.description,
        officialUrl: rec.officialUrl,
        sourceUrl: rec.sourceUrl,
        studyLevels: JSON.stringify(rec.levels),
        fundingType: rec.fundingType,
        fields: JSON.stringify([]),
        eligibleNationalities: JSON.stringify(["ALL"]),
        benefits: JSON.stringify(["tuition", "stipend", "housing", "insurance"]),
        requiredDocuments: JSON.stringify([]),
        applicationSteps: JSON.stringify([]),
        degrees: JSON.stringify([]),
        languageRequirements: JSON.stringify([]),
        status: "ACTIVE",
        recordType: "SCHOLARSHIP",
        verificationStatus: "VERIFIED",
        isFeatured: rec.title.includes("KAUST Fellowship") ? true : false,
        isTrending: false,
        views: 0,
        hostCountries: JSON.stringify(["SA"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    created++;
    console.log(`Created: ${rec.title}`);
  }
  console.log(`Done: created=${created} skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error("import-gap-sa:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
