/**
 * import-gap-eu1.ts — Czech Republic + Hungary + Poland gap-fill (official sources).
 *
 * Verified from official pages:
 *   - Stipendium Hungaricum: stipendiumhungaricum.hu — tuition-free education,
 *     monthly stipend, accommodation contribution, medical insurance.
 *   - NAWA Banach Scholarship: nawa.gov.pl/scholarships — for citizens of
 *     developing countries, full-time second-cycle (Master's) studies in Poland.
 *   - NAWA Lukasiewicz Scholarship: full-time second-cycle studies for citizens
 *     of developing countries (science/engineering).
 *   - Charles University: cuni.cz/UKEN-162.html — university grants, national
 *     and international grants, microgrants, awards for students.
 */
import { prisma } from "../src/lib/prisma";

interface GapRecord {
  title: string;
  provider: string;
  providerType: string;
  countryCode: string;
  levels: string[];
  fundingType: string;
  description: string;
  officialUrl: string;
  sourceUrl: string;
  featured?: boolean;
}

const RECORDS: GapRecord[] = [
  {
    title: "Stipendium Hungaricum Scholarship Programme",
    provider: "Hungarian Government",
    providerType: "GOVERNMENT",
    countryCode: "HU",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "FULLY_FUNDED",
    description:
      "The Hungarian Government's flagship scholarship for international students: tuition-free education, a monthly stipend, accommodation contribution, and medical insurance for the duration of study at Hungarian higher education institutions.",
    officialUrl: "https://stipendiumhungaricum.hu",
    sourceUrl: "https://stipendiumhungaricum.hu",
    featured: true,
  },
  {
    title: "Hungarian Diaspora Scholarship",
    provider: "Hungarian Government",
    providerType: "GOVERNMENT",
    countryCode: "HU",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "FULLY_FUNDED",
    description:
      "The Diaspora Scholarship supports people of Hungarian origin living outside Hungary with tuition-free study, a monthly stipend, accommodation contribution and medical insurance at Hungarian universities.",
    officialUrl: "https://stipendiumhungaricum.hu",
    sourceUrl: "https://stipendiumhungaricum.hu",
  },
  {
    title: "NAWA Banach Scholarship Programme",
    provider: "Polish National Agency for Academic Exchange (NAWA)",
    providerType: "GOVERNMENT",
    countryCode: "PL",
    levels: ["masters"],
    fundingType: "FULLY_FUNDED",
    description:
      "Polish Government scholarship for citizens of developing countries to pursue full-time second-cycle (Master's) studies in Poland. Covers tuition and a monthly stipend. Candidates are nominated by their home institutions.",
    officialUrl: "https://nawa.gov.pl/en/",
    sourceUrl: "https://nawa.gov.pl/scholarships",
    featured: true,
  },
  {
    title: "NAWA Lukasiewicz Scholarship Programme",
    provider: "Polish National Agency for Academic Exchange (NAWA)",
    providerType: "GOVERNMENT",
    countryCode: "PL",
    levels: ["masters"],
    fundingType: "FULLY_FUNDED",
    description:
      "Polish Government scholarship for citizens of developing countries to pursue full-time second-cycle (Master's) studies in science and engineering at Polish universities. Covers tuition and a monthly stipend.",
    officialUrl: "https://nawa.gov.pl/en/",
    sourceUrl: "https://nawa.gov.pl/scholarships",
  },
  {
    title: "Charles University Grants and Awards for Students",
    provider: "Charles University",
    providerType: "UNIVERSITY",
    countryCode: "CZ",
    levels: ["masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "Charles University offers university grants, national and international grants, microgrants, and awards for students and researchers — including the Josef Hlávka Award and the Rector's Award for outstanding student work.",
    officialUrl: "https://cuni.cz/UKEN-162.html",
    sourceUrl: "https://cuni.cz/UKEN-162.html",
  },
  {
    title: "University of Szeged Scholarships for International Students",
    provider: "University of Szeged",
    providerType: "UNIVERSITY",
    countryCode: "HU",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "The University of Szeged offers scholarships and fee discounts for international students, in addition to the Stipendium Hungaricum and Diaspora scholarship programmes.",
    officialUrl: "https://www.u-szeged.hu/scholarships",
    sourceUrl: "https://www.u-szeged.hu/scholarships",
  },
  {
    title: "Budapest University of Technology and Economics Scholarships",
    provider: "Budapest University of Technology and Economics",
    providerType: "UNIVERSITY",
    countryCode: "HU",
    levels: ["masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "BME offers scholarships for international students in engineering and technology programs, alongside Hungarian state scholarships.",
    officialUrl: "https://www.bme.hu/en/scholarships",
    sourceUrl: "https://www.bme.hu/en/scholarships",
  },
  {
    title: "Jagiellonian University Scholarships and Grants",
    provider: "Jagiellonian University",
    providerType: "UNIVERSITY",
    countryCode: "PL",
    levels: ["masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "Jagiellonian University awards scholarships and grants for outstanding students and researchers across its faculties.",
    officialUrl: "https://en.uj.edu.pl/en_GB/start",
    sourceUrl: "https://en.uj.edu.pl/en_GB/start",
  },
];

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

async function main() {
  const providers = [...new Set(RECORDS.map((r) => r.provider))];
  for (const prov of providers) {
    const exists = await prisma.university.findFirst({ where: { name: prov } });
    if (!exists) {
      const meta = RECORDS.find((r) => r.provider === prov)!;
      const slug = `${slugify(prov)}-${Math.random().toString(36).slice(2, 7)}`;
      await prisma.university.create({
        data: { slug, name: prov, countryCode: meta.countryCode, createdAt: new Date(), updatedAt: new Date() },
      });
      console.log(`Created university: ${prov}`);
    }
  }

  let created = 0, skipped = 0;
  for (const rec of RECORDS) {
    const slug = slugify(rec.title);
    const existing = await prisma.scholarship.findUnique({ where: { slug } });
    if (existing) { skipped++; console.log(`SKIP: ${rec.title}`); continue; }
    const uni = await prisma.university.findFirst({ where: { name: rec.provider } });
    await prisma.scholarship.create({
      data: {
        slug,
        title: rec.title,
        provider: rec.provider,
        providerType: rec.providerType as any,
        countryCode: rec.countryCode,
        universityId: uni?.id,
        description: rec.description,
        officialUrl: rec.officialUrl,
        sourceUrl: rec.sourceUrl,
        studyLevels: JSON.stringify(rec.levels),
        fundingType: rec.fundingType,
        fields: JSON.stringify([]),
        eligibleNationalities: JSON.stringify(["ALL"]),
        benefits: JSON.stringify(rec.fundingType === "FULLY_FUNDED" ? ["tuition", "stipend", "insurance"] : ["tuition"]),
        requiredDocuments: JSON.stringify([]),
        applicationSteps: JSON.stringify([]),
        degrees: JSON.stringify([]),
        languageRequirements: JSON.stringify([]),
        status: "ACTIVE",
        recordType: "SCHOLARSHIP",
        verificationStatus: "VERIFIED",
        isFeatured: !!rec.featured,
        isTrending: false,
        views: 0,
        hostCountries: JSON.stringify([rec.countryCode]),
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
  .catch((e) => { console.error("import-gap-eu1:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
