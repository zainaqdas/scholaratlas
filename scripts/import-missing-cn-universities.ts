import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/utils";

// ---------------------------------------------------------------------------
// Curated import for the 8 Chinese universities that were completely absent
// from the catalogue (found via the faculty_data_all.xlsx cross-check):
//
//   Central South University, Fudan University, Peking Union Medical College,
//   Xi'an Jiaotong University, Anhui Medical University, Beihua University,
//   Nantong University, Southwest Medical University
//
// Data sources (verified one at a time, official sites only):
//   * Anhui Medical University — english.ahmu.edu.cn Admissions Guide 2024
//     (3 scholarships with exact RMB amounts: CSC, Silk Road, Anhui Provincial)
//   * Fudan University — iso.fudan.edu.cn Scholarship page
//     (Chinese Government, Shanghai Government, Confucius Institute)
//   * The remaining 6 are all CSC-designated universities — the Chinese
//     Government Scholarship (CSC) is offered at each of them; record content
//     follows the standardized CSC terms (tuition + accommodation + monthly
//     allowance + insurance) with the official portal studyinchina.csc.edu.cn.
//
// All records are UNVERIFIED (consistent with the existing CSC imports) so
// they surface for admin review.
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

interface Rec {
  university: string;
  title: string;
  provider: string;
  providerType: string;
  fundingType: string;
  benefits: string;
  amount: string | null;
  deadline: Date | null;
  deadlineTimezone: string | null;
  officialUrl: string;
  sourceUrl: string;
  description: string;
  studyLevels: string;
  fields: string;
}

const NOW = new Date();
function deadlineUTC(month: number, day: number): Date | null {
  let year = NOW.getUTCFullYear();
  let d = new Date(Date.UTC(year, month, day, 23, 59, 0));
  if (d.getTime() < NOW.getTime()) {
    year += 1;
    d = new Date(Date.UTC(year, month, day, 23, 59, 0));
  }
  return d;
}

const RECORDS: Rec[] = [
  // -------------------------------------------------------------- Anhui Medical
  {
    university: "Anhui Medical University",
    title: "Anhui Medical University Chinese Government Scholarship",
    provider: "China Scholarship Council (CSC)",
    providerType: "GOVERNMENT",
    fundingType: "FULLY_FUNDED",
    benefits: JSON.stringify(["TUITION", "ACCOMMODATION", "STIPEND", "INSURANCE"]),
    amount: "Undergraduates: RMB 66,200/year · Postgraduates: RMB 79,200/year · Doctoral: RMB 99,800/year",
    deadline: deadlineUTC(2, 31), // ~end of March (standard CSC round)
    deadlineTimezone: "UTC",
    officialUrl: "https://english.ahmu.edu.cn/",
    sourceUrl: "https://english.ahmu.edu.cn/5321/list.htm",
    description:
      "The Chinese Government Scholarship at Anhui Medical University covers registration, tuition, laboratory/experiment fees, basic learning materials, on-campus accommodation and a monthly living allowance. Undergraduates receive RMB 66,200 per year, postgraduates RMB 79,200 per year and doctoral candidates RMB 99,800 per year. All medical programmes are taught in English; applicants must have a good command of English (mother tongue English, or prior English-medium study).",
    studyLevels: JSON.stringify(["undergraduate", "masters", "phd"]),
    fields: JSON.stringify(["medicine", "nursing", "public-health", "dentistry", "pharmacy"]),
  },
  {
    university: "Anhui Medical University",
    title: "Anhui Medical University Silk Road Scholarship",
    provider: "Anhui Medical University",
    providerType: "UNIVERSITY",
    fundingType: "PARTIAL",
    benefits: JSON.stringify(["TUITION", "STIPEND"]),
    amount: "Tuition fee waiver + RMB 10,000/year living allowance (2 places/year)",
    deadline: null,
    deadlineTimezone: null,
    officialUrl: "https://english.ahmu.edu.cn/",
    sourceUrl: "https://english.ahmu.edu.cn/5321/list.htm",
    description:
      "The Silk Road Scholarship at Anhui Medical University offers 2 places per year for undergraduates, postgraduates and doctoral candidates. Recipients get a tuition fee waiver plus a living allowance of RMB 10,000 per year. All courses are taught in English.",
    studyLevels: JSON.stringify(["undergraduate", "masters", "phd"]),
    fields: JSON.stringify(["medicine", "nursing", "public-health", "dentistry", "pharmacy"]),
  },
  {
    university: "Anhui Medical University",
    title: "Anhui Provincial Government Scholarship",
    provider: "Anhui Provincial Government",
    providerType: "GOVERNMENT",
    fundingType: "PARTIAL",
    benefits: JSON.stringify(["STIPEND"]),
    amount: "Undergraduates: RMB 20,000/year · Postgraduates: RMB 30,000/year · Doctoral: RMB 50,000/year",
    deadline: null,
    deadlineTimezone: null,
    officialUrl: "https://english.ahmu.edu.cn/",
    sourceUrl: "https://english.ahmu.edu.cn/5321/list.htm",
    description:
      "The Anhui Provincial Government Scholarship supports international students at Anhui Medical University with a yearly stipend: RMB 20,000 for undergraduates, RMB 30,000 for postgraduates and RMB 50,000 for doctoral candidates. English-taught medical programmes.",
    studyLevels: JSON.stringify(["undergraduate", "masters", "phd"]),
    fields: JSON.stringify(["medicine", "nursing", "public-health", "dentistry", "pharmacy"]),
  },

  // -------------------------------------------------------------------- Fudan
  {
    university: "Fudan University",
    title: "Fudan University Chinese Government Scholarship",
    provider: "China Scholarship Council (CSC)",
    providerType: "GOVERNMENT",
    fundingType: "FULLY_FUNDED",
    benefits: JSON.stringify(["TUITION", "ACCOMMODATION", "STIPEND", "INSURANCE"]),
    amount: "Monthly allowance: 2,500 RMB (UG) · 3,000 RMB (Masters) · 3,500 RMB (PhD)",
    deadline: deadlineUTC(2, 31),
    deadlineTimezone: "UTC",
    officialUrl: "https://iso.fudan.edu.cn/isoenglish/",
    sourceUrl: "https://iso.fudan.edu.cn/isoenglish/16210/list.htm",
    description:
      "The Chinese Government Scholarship at Fudan University covers tuition, on-campus accommodation, a monthly living allowance (2,500 RMB for undergraduates, 3,000 RMB for master's, 3,500 RMB for doctoral students) and comprehensive medical insurance. Fudan is one of China's top universities and a CSC-designated host institution.",
    studyLevels: JSON.stringify(["undergraduate", "masters", "phd"]),
    fields: JSON.stringify([]),
  },
  {
    university: "Fudan University",
    title: "Shanghai Government Scholarship at Fudan University",
    provider: "Shanghai Municipal Government",
    providerType: "GOVERNMENT",
    fundingType: "PARTIAL",
    benefits: JSON.stringify(["TUITION", "ACCOMMODATION"]),
    amount: null,
    deadline: null,
    deadlineTimezone: null,
    officialUrl: "https://iso.fudan.edu.cn/isoenglish/",
    sourceUrl: "https://iso.fudan.edu.cn/isoenglish/16210/list.htm",
    description:
      "The Shanghai Government Scholarship supports international students at Fudan University with tuition and accommodation coverage. Available for degree programmes at undergraduate, master's and doctoral level.",
    studyLevels: JSON.stringify(["undergraduate", "masters", "phd"]),
    fields: JSON.stringify([]),
  },
  {
    university: "Fudan University",
    title: "Confucius Institute Scholarship at Fudan University",
    provider: "Confucius Institute",
    providerType: "GOVERNMENT",
    fundingType: "FULLY_FUNDED",
    benefits: JSON.stringify(["TUITION", "ACCOMMODATION", "STIPEND"]),
    amount: null,
    deadline: null,
    deadlineTimezone: null,
    officialUrl: "https://iso.fudan.edu.cn/isoenglish/",
    sourceUrl: "https://iso.fudan.edu.cn/isoenglish/16210/list.htm",
    description:
      "The Confucius Institute Scholarship supports international students studying Chinese language and culture at Fudan University, covering tuition, accommodation and a monthly stipend.",
    studyLevels: JSON.stringify(["undergraduate", "masters", "phd"]),
    fields: JSON.stringify(["languages", "literature"]),
  },

  // ------------------------------------------- Central South (CSC-designated)
  {
    university: "Central South University",
    title: "Central South University Chinese Government Scholarship",
    provider: "China Scholarship Council (CSC)",
    providerType: "GOVERNMENT",
    fundingType: "FULLY_FUNDED",
    benefits: JSON.stringify(["TUITION", "ACCOMMODATION", "STIPEND", "INSURANCE"]),
    amount: "Monthly allowance: 2,500 RMB (UG) · 3,000 RMB (Masters) · 3,500 RMB (PhD)",
    deadline: deadlineUTC(2, 31),
    deadlineTimezone: "UTC",
    officialUrl: "https://studyinchina.csc.edu.cn/",
    sourceUrl: "https://en.csu.edu.cn/Int_l_Student.htm",
    description:
      "The Chinese Government Scholarship at Central South University (home of the renowned Xiangya School of Medicine) covers tuition, on-campus accommodation, a monthly living allowance and comprehensive medical insurance for international students at undergraduate, master's and doctoral level.",
    studyLevels: JSON.stringify(["undergraduate", "masters", "phd"]),
    fields: JSON.stringify(["medicine", "nursing", "public-health", "dentistry", "pharmacy"]),
  },

  // --------------------------------------------- Peking Union Medical College
  {
    university: "Peking Union Medical College",
    title: "Peking Union Medical College Chinese Government Scholarship",
    provider: "China Scholarship Council (CSC)",
    providerType: "GOVERNMENT",
    fundingType: "FULLY_FUNDED",
    benefits: JSON.stringify(["TUITION", "ACCOMMODATION", "STIPEND", "INSURANCE"]),
    amount: "Monthly allowance: 3,000 RMB (Masters) · 3,500 RMB (PhD)",
    deadline: deadlineUTC(2, 31),
    deadlineTimezone: "UTC",
    officialUrl: "https://studyinchina.csc.edu.cn/",
    sourceUrl: "https://english.pumc.edu.cn/",
    description:
      "The Chinese Government Scholarship at Peking Union Medical College (CAMS & PUMC — China's premier medical institution) covers tuition, on-campus accommodation, a monthly living allowance and comprehensive medical insurance for international students in master's and doctoral medical programmes.",
    studyLevels: JSON.stringify(["masters", "phd"]),
    fields: JSON.stringify(["medicine", "nursing", "public-health", "pharmacy"]),
  },

  // ------------------------------------------------------ Xi'an Jiaotong Univ.
  {
    university: "Xi'an Jiaotong University",
    title: "Xi'an Jiaotong University Chinese Government Scholarship",
    provider: "China Scholarship Council (CSC)",
    providerType: "GOVERNMENT",
    fundingType: "FULLY_FUNDED",
    benefits: JSON.stringify(["TUITION", "ACCOMMODATION", "STIPEND", "INSURANCE"]),
    amount: "Monthly allowance: 2,500 RMB (UG) · 3,000 RMB (Masters) · 3,500 RMB (PhD)",
    deadline: deadlineUTC(2, 31),
    deadlineTimezone: "UTC",
    officialUrl: "https://studyinchina.csc.edu.cn/",
    sourceUrl: "http://sie.xjtu.edu.cn/en/SCHOLARSHIPS1/Chinese_Government_Scholarships.htm",
    description:
      "The Chinese Government Scholarship at Xi'an Jiaotong University covers tuition, on-campus accommodation, a monthly living allowance and comprehensive medical insurance. XJTU is a CSC-designated university and one of China's oldest and most prestigious engineering universities.",
    studyLevels: JSON.stringify(["undergraduate", "masters", "phd"]),
    fields: JSON.stringify(["engineering", "medicine", "computer-science"]),
  },

  // ------------------------------------------------------------ Beihua Univ.
  {
    university: "Beihua University",
    title: "Beihua University Chinese Government Scholarship",
    provider: "China Scholarship Council (CSC)",
    providerType: "GOVERNMENT",
    fundingType: "FULLY_FUNDED",
    benefits: JSON.stringify(["TUITION", "ACCOMMODATION", "STIPEND", "INSURANCE"]),
    amount: "Monthly allowance: 2,500 RMB (UG) · 3,000 RMB (Masters) · 3,500 RMB (PhD)",
    deadline: deadlineUTC(2, 31),
    deadlineTimezone: "UTC",
    officialUrl: "https://studyinchina.csc.edu.cn/",
    sourceUrl: "https://en.beihua.edu.cn/",
    description:
      "The Chinese Government Scholarship at Beihua University (Jilin Province) covers tuition, on-campus accommodation, a monthly living allowance and comprehensive medical insurance for international students at undergraduate, master's and doctoral level.",
    studyLevels: JSON.stringify(["undergraduate", "masters", "phd"]),
    fields: JSON.stringify(["medicine", "engineering"]),
  },

  // ---------------------------------------------------------- Nantong Univ.
  {
    university: "Nantong University",
    title: "Nantong University Chinese Government Scholarship",
    provider: "China Scholarship Council (CSC)",
    providerType: "GOVERNMENT",
    fundingType: "FULLY_FUNDED",
    benefits: JSON.stringify(["TUITION", "ACCOMMODATION", "STIPEND", "INSURANCE"]),
    amount: "Monthly allowance: 2,500 RMB (UG) · 3,000 RMB (Masters) · 3,500 RMB (PhD)",
    deadline: deadlineUTC(2, 31),
    deadlineTimezone: "UTC",
    officialUrl: "https://studyinchina.csc.edu.cn/",
    sourceUrl: "https://en.ntu.edu.cn/",
    description:
      "The Chinese Government Scholarship at Nantong University (Jiangsu Province) covers tuition, on-campus accommodation, a monthly living allowance and comprehensive medical insurance for international students at undergraduate, master's and doctoral level.",
    studyLevels: JSON.stringify(["undergraduate", "masters", "phd"]),
    fields: JSON.stringify(["medicine", "engineering"]),
  },

  // --------------------------------------------------- Southwest Medical Univ.
  {
    university: "Southwest Medical University",
    title: "Southwest Medical University Chinese Government Scholarship",
    provider: "China Scholarship Council (CSC)",
    providerType: "GOVERNMENT",
    fundingType: "FULLY_FUNDED",
    benefits: JSON.stringify(["TUITION", "ACCOMMODATION", "STIPEND", "INSURANCE"]),
    amount: "Monthly allowance: 2,500 RMB (UG) · 3,000 RMB (Masters) · 3,500 RMB (PhD)",
    deadline: deadlineUTC(2, 31),
    deadlineTimezone: "UTC",
    officialUrl: "https://studyinchina.csc.edu.cn/",
    sourceUrl: "https://en.swmu.edu.cn/International1/Admission.htm",
    description:
      "The Chinese Government Scholarship at Southwest Medical University (Luzhou, Sichuan Province) covers tuition, on-campus accommodation, a monthly living allowance and comprehensive medical insurance. The university offers Chinese-language, postgraduate and traditional Chinese medicine programmes for international students.",
    studyLevels: JSON.stringify(["undergraduate", "masters", "phd"]),
    fields: JSON.stringify(["medicine", "nursing", "pharmacy", "traditional-chinese-medicine"]),
  },
];

async function main() {
  // Look up the University records created in Phase 1.
  const unis = await prisma.university.findMany({
    where: { name: { in: [...new Set(RECORDS.map((r) => r.university))] } },
    select: { id: true, name: true },
  });
  const uniById = new Map(unis.map((u) => [u.name, u.id]));
  const missing = [...new Set(RECORDS.map((r) => r.university))].filter((n) => !uniById.has(n));
  if (missing.length) {
    console.error(`Missing University records for: ${missing.join(", ")}`);
    process.exit(1);
  }

  const rows = RECORDS.map((r) => ({
    title: r.title,
    slug: slugify(r.title),
    description: r.description,
    provider: r.provider,
    providerType: r.providerType,
    universityId: uniById.get(r.university)!,
    countryCode: "CN",
    studyLevels: r.studyLevels,
    fields: r.fields,
    eligibleNationalities: JSON.stringify(["ALL"]),
    fundingType: r.fundingType,
    benefits: r.benefits,
    amount: r.amount,
    deadline: r.deadline,
    deadlineTimezone: r.deadlineTimezone,
    languageRequirements: JSON.stringify({}),
    requiredDocuments: JSON.stringify([]),
    applicationSteps: JSON.stringify([]),
    officialUrl: r.officialUrl,
    sourceUrl: r.sourceUrl,
    recordType: "SCHOLARSHIP",
    verificationStatus: "UNVERIFIED",
    status: "ACTIVE",
    submittedNote: `Curated from official university sources on ${new Date().toISOString().slice(0, 10)} (unverified — pending admin review)`,
  }));

  console.log(`Planned ${rows.length} records across ${new Set(RECORDS.map((r) => r.university)).size} universities:`);
  for (const r of rows) {
    console.log(`  ${r.universityId ? "" : "!"} ${r.title} (${r.fundingType})`);
  }

  if (DRY_RUN) {
    console.log("[dry-run] no changes made.");
    return;
  }

  // Idempotent: skip records whose sourceUrl already exists.
  const existing = await prisma.scholarship.findMany({
    where: { sourceUrl: { in: rows.map((r) => r.sourceUrl!) } },
    select: { sourceUrl: true },
  });
  const existingUrls = new Set(existing.map((e) => e.sourceUrl as string));
  const fresh = rows.filter((r) => !existingUrls.has(r.sourceUrl!));

  let inserted = 0;
  for (const row of fresh) {
    try {
      await prisma.scholarship.create({ data: row });
      inserted++;
      console.log(`  ✓ ${row.title}`);
    } catch (e) {
      console.error(`  ✗ ${row.title}: ${e instanceof Error ? e.message.slice(0, 120) : e}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`Inserted ${inserted}/${rows.length} (${rows.length - inserted} already present).`);
}

main()
  .catch((err) => {
    console.error("Import failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
