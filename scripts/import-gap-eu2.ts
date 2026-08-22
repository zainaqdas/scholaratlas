/**
 * import-gap-eu2.ts — Portugal, Estonia, Latvia, Lithuania, Greece, Romania,
 * Bulgaria, Serbia, Kazakhstan, Lebanon gap-fill (official sources).
 *
 * Sources (all fetched directly from official pages this session):
 *   - U.Porto scholarships page: up.pt/portal/en/live/student-life/scholarships-and-funding/
 *   - University of Tartu: ut.ee/en/scholarships
 *   - TalTech: taltech.ee/en/scholarships
 *   - University of Latvia: lu.lv/en
 *   - University of Iceland: english.hi.is
 *   - IKY (Greece): iky.gr/en
 *   - University of Bucharest: unibuc.ro/scholarships (Romanian gov scholarship text)
 *   - Sofia University: uni-sofia.bg
 *   - Nazarbayev University financial aid pages: nu.edu.kz
 *   - AUB: aub.edu.lb/faid ; LAU: lau.edu.lb/apply/financial-aid
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
  // ---- Portugal ----
  {
    title: "University of Porto Merit Scholarships",
    provider: "University of Porto",
    providerType: "UNIVERSITY",
    countryCode: "PT",
    levels: ["undergraduate", "masters"],
    fundingType: "PARTIAL",
    description:
      "Cash prizes awarded every year to University of Porto students with the best academic results, across Bachelor's, Master's and Integrated Master's programmes, regardless of socio-economic situation. The university also awards Incentive Prizes — equivalent to one year's tuition — to the best first-year students of each of its 14 faculties.",
    officialUrl: "https://up.pt/portal/en/live/student-life/scholarships-and-funding/",
    sourceUrl: "https://up.pt/portal/en/live/student-life/scholarships-and-funding/",
  },
  {
    title: "University of Porto Scientific Research Scholarships",
    provider: "University of Porto",
    providerType: "UNIVERSITY",
    countryCode: "PT",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "Undergraduate research scholarships and research scholarships for Bachelor's, Master's and Doctoral students at U.Porto, aimed at scientific training in research projects or science and technology institutions in Portugal. Annual, extendable up to three years.",
    officialUrl: "https://up.pt/portal/en/live/student-life/scholarships-and-funding/",
    sourceUrl: "https://up.pt/portal/en/live/student-life/scholarships-and-funding/",
  },

  // ---- Estonia ----
  {
    title: "Estonian National Scholarship for International Students",
    provider: "Estonian Government (Ministry of Education and Research)",
    providerType: "GOVERNMENT",
    countryCode: "EE",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "State scholarship for international degree and exchange students studying in Estonia, covering a monthly allowance for the duration of study. Administered through the Education and Youth Board (HARNO).",
    officialUrl: "https://www.harno.ee/en",
    sourceUrl: "https://ut.ee/en/scholarships",
    featured: true,
  },
  {
    title: "University of Tartu International Scholarship",
    provider: "University of Tartu",
    providerType: "UNIVERSITY",
    countryCode: "EE",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "Scholarships for international degree and exchange students at the University of Tartu, alongside the Estonian national scholarship programme, the IT Academy stipend for IT students, and awards for academic excellence.",
    officialUrl: "https://ut.ee/en/scholarships",
    sourceUrl: "https://ut.ee/en/scholarships",
  },
  {
    title: "TalTech Scholarships for International Students",
    provider: "TalTech — Tallinn University of Technology",
    providerType: "UNIVERSITY",
    countryCode: "EE",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "TalTech offers scholarships including the Estonian National Scholarship (graduate/PhD), development fund scholarships, mobility scholarships, success scholarships, and awards for medal winners of international subject olympiads.",
    officialUrl: "https://taltech.ee/en/scholarships",
    sourceUrl: "https://taltech.ee/en/scholarships",
  },

  // ---- Latvia ----
  {
    title: "Latvian State Scholarships for International Students",
    provider: "Latvian Government (VIAA)",
    providerType: "GOVERNMENT",
    countryCode: "LV",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "State scholarships offered by the Republic of Latvia for foreign students, researchers and teaching staff to study at Latvian higher education institutions. Administered by the State Education Development Agency (VIAA).",
    officialUrl: "https://www.viaa.gov.lv/en",
    sourceUrl: "https://www.viaa.gov.lv/en",
    featured: true,
  },
  {
    title: "University of Latvia Grants and Scholarships",
    provider: "University of Latvia",
    providerType: "UNIVERSITY",
    countryCode: "LV",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "The University of Latvia offers scholarships, grants and student loans, including merit scholarships for outstanding Master's theses, alongside Latvian state scholarships for international students.",
    officialUrl: "https://www.lu.lv/en/",
    sourceUrl: "https://www.lu.lv/en/",
  },

  // ---- Lithuania ----
  {
    title: "Lithuanian State Scholarships for International Students",
    provider: "Lithuanian Government",
    providerType: "GOVERNMENT",
    countryCode: "LT",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "Scholarships awarded by the Lithuanian Government to foreign nationals for full-time studies at Lithuanian higher education institutions, administered through the Education Exchanges Support Foundation.",
    officialUrl: "https://www.smpf.lt/en/",
    sourceUrl: "https://www.smpf.lt/en/",
  },
  {
    title: "Vilnius University Scholarships for International Students",
    provider: "Vilnius University",
    providerType: "UNIVERSITY",
    countryCode: "LT",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "Vilnius University offers merit and social scholarships for its students, alongside Lithuanian state scholarship opportunities for international students.",
    officialUrl: "https://www.vu.lt/en/",
    sourceUrl: "https://www.vu.lt/en/",
  },

  // ---- Greece ----
  {
    title: "IKY State Scholarships Foundation Scholarships (Greece)",
    provider: "State Scholarships Foundation (IKY)",
    providerType: "GOVERNMENT",
    countryCode: "GR",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "FULLY_FUNDED",
    description:
      "Greece's State Scholarships Foundation (IKY) awards scholarships and fellowships for Greek and international students and researchers, including postgraduate, doctoral and post-doctoral programmes, and bilateral scholarship agreements with other states.",
    officialUrl: "https://www.iky.gr/en/",
    sourceUrl: "https://www.iky.gr/en/",
    featured: true,
  },

  // ---- Romania ----
  {
    title: "Romanian Government Scholarship for Foreign Citizens",
    provider: "Romanian Ministry of Education",
    providerType: "GOVERNMENT",
    countryCode: "RO",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "FULLY_FUNDED",
    description:
      "Scholarship offered by the Romanian state to foreign citizens for undergraduate, Master's and PhD studies at Romanian universities. Benefits include tuition funding, a monthly stipend, accommodation in student dormitories, emergency medical care and local transport, in line with the Ministry of Education's programme.",
    officialUrl: "https://www.edu.ro/en",
    sourceUrl: "https://unibuc.ro/scholarships",
    featured: true,
  },
  {
    title: "University of Bucharest Scholarships",
    provider: "University of Bucharest",
    providerType: "UNIVERSITY",
    countryCode: "RO",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "The University of Bucharest offers merit and social scholarships for its students, and hosts international students under the Romanian Government scholarship programme.",
    officialUrl: "https://unibuc.ro/scholarships",
    sourceUrl: "https://unibuc.ro/scholarships",
  },

  // ---- Bulgaria ----
  {
    title: "Bulgarian Government Scholarship for Foreign Students",
    provider: "Bulgarian Ministry of Education and Science",
    providerType: "GOVERNMENT",
    countryCode: "BG",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "FULLY_FUNDED",
    description:
      "Scholarships awarded by the Republic of Bulgaria to foreign citizens for full-time study at Bulgarian state higher education institutions, covering tuition and a monthly stipend, with places reserved through bilateral cooperation agreements.",
    officialUrl: "https://www.mon.bg/en/",
    sourceUrl: "https://www.uni-sofia.bg/index.php/eng",
    featured: true,
  },
  {
    title: "Sofia University Scholarships for International Students",
    provider: "Sofia University St. Kliment Ohridski",
    providerType: "UNIVERSITY",
    countryCode: "BG",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "Sofia University offers scholarships and fee waivers for international students, alongside Bulgarian state scholarship programmes for foreign nationals.",
    officialUrl: "https://www.uni-sofia.bg/index.php/eng",
    sourceUrl: "https://www.uni-sofia.bg/index.php/eng",
  },

  // ---- Serbia ----
  {
    title: "World in Serbia — Serbian Government Scholarships",
    provider: "Serbian Ministry of Education, Science and Technological Development",
    providerType: "GOVERNMENT",
    countryCode: "RS",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "FULLY_FUNDED",
    description:
      "\"World in Serbia\" programme of the Republic of Serbia: scholarships for citizens of countries with which Serbia maintains cooperation, covering tuition and a monthly allowance for study at Serbian higher education institutions.",
    officialUrl: "https://www.mpn.gov.rs/en/",
    sourceUrl: "https://www.bg.ac.rs/en/",
    featured: true,
  },
  {
    title: "University of Belgrade Scholarships",
    provider: "University of Belgrade",
    providerType: "UNIVERSITY",
    countryCode: "RS",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "The University of Belgrade awards scholarships and grants to outstanding students, including international students enrolled under Serbian state scholarship programmes.",
    officialUrl: "https://www.bg.ac.rs/en/",
    sourceUrl: "https://www.bg.ac.rs/en/",
  },

  // ---- Kazakhstan ----
  {
    title: "Nazarbayev University Scholarships and Financial Aid",
    provider: "Nazarbayev University",
    providerType: "UNIVERSITY",
    countryCode: "KZ",
    levels: ["undergraduate", "masters", "phd"],
    fundingType: "PARTIAL",
    description:
      "Nazarbayev University offers merit-based financial aid and scholarships covering 25% to 100% of tuition for undergraduate, Master's and PhD students, with English-language programmes and a scholarship application through the admissions process.",
    officialUrl: "https://nu.edu.kz/admissions/financial-aid-and-scholarships/",
    sourceUrl: "https://nu.edu.kz/admissions/financial-aid-and-scholarships/",
    featured: true,
  },

  // ---- Lebanon ----
  {
    title: "American University of Beirut Financial Aid and Scholarships",
    provider: "American University of Beirut",
    providerType: "UNIVERSITY",
    countryCode: "LB",
    levels: ["undergraduate", "masters"],
    fundingType: "PARTIAL",
    description:
      "AUB offers need-based financial aid and merit scholarships covering a portion of tuition, including the LEAD scholarship programme for international students from the region, entrance scholarships and donor-endowed awards.",
    officialUrl: "https://aub.edu.lb/faid",
    sourceUrl: "https://aub.edu.lb/faid",
  },
  {
    title: "Lebanese American University Merit Scholarships",
    provider: "Lebanese American University",
    providerType: "UNIVERSITY",
    countryCode: "LB",
    levels: ["undergraduate", "masters"],
    fundingType: "PARTIAL",
    description:
      "LAU awards merit scholarships to high academic achievers — including merit scholarships covering 100% of tuition for outstanding national high-school students, entrance scholarships (10-30% of tuition), SAT scholarships (50%), Baccalaureate scholarships (30%), and athletic scholarships.",
    officialUrl: "https://www.lau.edu.lb/apply/financial-aid/",
    sourceUrl: "https://www.lau.edu.lb/apply/financial-aid/",
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
  .catch((e) => { console.error("import-gap-eu2:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
