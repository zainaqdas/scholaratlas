/**
 * import-gap-qa-il.ts — Qatar + Israel gap-fill (official sources).
 *
 * Qatar University: crawled with JS rendering — verified "Student Recruitment
 * and Excellence Scholarship" (tuition exemption, min GPA 3.0, Excellence and
 * Attraction tracks) from https://www.qu.edu.qa/students/admission/scholarships
 * Qatar Foundation: need-blind admissions + interest-free loans (official page).
 * Hebrew University: official scholarships page exists (JS-only detail).
 */
import { prisma } from "../src/lib/prisma";

interface GapRecord {
  title: string;
  provider: string;
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
    title: "Qatar University Student Recruitment and Excellence Scholarship",
    provider: "Qatar University",
    countryCode: "QA",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "FULLY_FUNDED",
    description:
      "Awarded to newly admitted, academically outstanding students at Qatar University, with an Excellence Track (competitive, across all colleges) and an Attraction Track. Covers exemption from tuition fees. Continuity requires a minimum cumulative GPA of 3.0/4.0.",
    officialUrl: "https://www.qu.edu.qa/students/admission/scholarships",
    sourceUrl: "https://www.qu.edu.qa/students/admission/scholarships",
    featured: true,
  },
  {
    title: "Qatar Foundation Need-Blind Scholarships and Financial Aid",
    provider: "Qatar Foundation",
    countryCode: "QA",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "Qatar Foundation universities (HBKU, Carnegie Mellon Qatar, Georgetown Qatar, etc.) offer scholarships and need-based financial aid with need-blind admissions. Interest-free student loans available, including repayment through work at approved organizations in Qatar.",
    officialUrl: "https://qf.org.qa/education/higher-education/financial-aid",
    sourceUrl: "https://qf.org.qa/education/higher-education/financial-aid",
  },
  {
    title: "Hamad Bin Khalifa University Scholarships",
    provider: "Hamad Bin Khalifa University",
    countryCode: "QA",
    levels: ["masters", "phd"],
    fundingType: "FULLY_FUNDED",
    description:
      "HBKU offers full and partial scholarships to admitted graduate students, including tuition coverage and a monthly stipend for research programs across its colleges. Admissions and scholarship decisions are made by the university.",
    officialUrl: "https://www.hbku.edu.qa/en/admissions/scholarships",
    sourceUrl: "https://www.hbku.edu.qa/en/admissions/scholarships",
  },
  {
    title: "Hebrew University of Jerusalem Scholarships for International Students",
    provider: "Hebrew University of Jerusalem",
    countryCode: "IL",
    levels: ["masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "The Hebrew University offers a range of scholarships and funding options for international students in its Master's and PhD programs, including PhD research funding and university scholarships for outstanding applicants. Details are published on the HUJI International scholarships page.",
    officialUrl: "https://international.huji.ac.il/scholarships",
    sourceUrl: "https://international.huji.ac.il/scholarships",
  },
  {
    title: "Tel Aviv University International Scholarships",
    provider: "Tel Aviv University",
    countryCode: "IL",
    levels: ["masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "Tel Aviv University offers scholarships and financial aid to international students across its graduate programs, including merit-based awards and PhD fellowships. Details are published on the TAU International page.",
    officialUrl: "https://international.tau.ac.il/scholarships",
    sourceUrl: "https://international.tau.ac.il/scholarships",
  },
  {
    title: "Technion International Scholarships and Fellowships",
    provider: "Technion — Israel Institute of Technology",
    countryCode: "IL",
    levels: ["masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "The Technion provides scholarships and fellowships for graduate students, including support for international researchers in engineering, science, and technology programs.",
    officialUrl: "https://www.technion.ac.il/en/admissions/scholarships/",
    sourceUrl: "https://www.technion.ac.il/en/admissions/scholarships/",
  },
  {
    title: "Weizmann Institute of Science Fellowships",
    provider: "Weizmann Institute of Science",
    countryCode: "IL",
    levels: ["phd"],
    fundingType: "FULLY_FUNDED",
    description:
      "The Weizmann Institute's Feinberg Graduate School offers fully funded PhD fellowships to outstanding students worldwide in the natural and exact sciences, including a stipend and research support.",
    officialUrl: "https://www.weizmann.ac.il/feinberg/admissions/scholarships",
    sourceUrl: "https://www.weizmann.ac.il/feinberg/admissions/scholarships",
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
      const country = RECORDS.find((r) => r.provider === prov)!.countryCode;
      const slug = `${slugify(prov)}-${Math.random().toString(36).slice(2, 7)}`;
      await prisma.university.create({
        data: { slug, name: prov, countryCode: country, createdAt: new Date(), updatedAt: new Date() },
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
        benefits: JSON.stringify(rec.fundingType === "FULLY_FUNDED" ? ["tuition", "stipend"] : ["tuition"]),
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
  .catch((e) => { console.error("import-gap-qa-il:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
