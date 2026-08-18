/**
 * Backfill English-language requirements — round 2 (2026-08-18).
 *
 * The next tier of non-China universities whose ACTIVE records lack language
 * data. Every school here teaches in English and requires international
 * applicants to prove proficiency, so the flags are ielts:true, toefl:true,
 * altProof:true, noIelts:false; the exact scores are recorded in the
 * description note with the source URL (all verified from the university's
 * own site, August 2026).
 *
 * Usage:
 *   npx tsx scripts/backfill-uni-language2.ts
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

interface Policy {
  match: string[]; // university-name ILIKE patterns
  ielts: string;
  toefl: string;
  extra?: string;
  note: string;
  source: string;
}

const POLICIES: Policy[] = [
  {
    match: ["New York Institute of Technology"],
    ielts: "6.0",
    toefl: "79 (iBT)",
    extra: "PTE 53; Duolingo 105",
    note: "New York Institute of Technology English requirements for full admission: IELTS 6.0, TOEFL iBT 79, Pearson PTE 53, or Duolingo English Test 105. IB and certain English-medium study may waive the requirement.",
    source: "nyit.edu/admissions/international",
  },
  {
    match: ["Monash"],
    ielts: "6.5 overall (min. 6.0 in each band)",
    toefl: "79 (iBT; min. 13 reading, 12 listening, 21 writing, 18 speaking)",
    extra: "PTE 58; Cambridge C1 176",
    note: "Monash University standard English requirement: IELTS Academic 6.5 overall with a minimum of 6.0 in each band, TOEFL iBT 79 (min. 13 reading, 12 listening, 21 writing, 18 speaking), PTE Academic 58, or Cambridge C1 Advanced 176. Some courses (e.g. medicine, law) require higher scores.",
    source: "monash.edu/admissions/entry-requirements/english-language",
  },
  {
    match: ["University of Pennsylvania"],
    ielts: "7.0 (typical)",
    toefl: "100 (iBT, typical)",
    extra: "Duolingo English Test accepted",
    note: "University of Pennsylvania requires proof of English proficiency for international applicants; successful applicants typically score 100+ on TOEFL iBT or 7.0+ on IELTS (Duolingo also accepted). Penn does not currently accept IELTS Indicator or One Skill Retake; check the specific school's requirement.",
    source: "admissions.upenn.edu/how-to-apply/international-applicants",
  },
  {
    match: ["Nottingham Trent"],
    ielts: "6.5 overall (min. 5.5 in each component)",
    toefl: "72 (iBT)",
    note: "Nottingham Trent University English language requirements: most courses require IELTS Academic 6.5 with a minimum of 5.5 in each component, or TOEFL iBT 72; some courses require 6.0 or 7.0. NTU accepts IELTS One Skill Retake and Pearson PTE.",
    source: "ntu.ac.uk/international/your-application/entry-requirements/english-language-requirements",
  },
  {
    match: ["University of Technology Sydney"],
    ielts: "6.5 overall (typical)",
    toefl: "79 (iBT, typical)",
    note: "UTS English language requirements: most programs require IELTS Academic 6.5 overall or TOEFL iBT 79; higher scores are required for competitive programs. UTS also accepts PTE Academic and Cambridge English.",
    source: "uts.edu.au/for-students/admissions-entry/eligibility/english-language-requirements",
  },
  {
    match: ["Lancaster University"],
    ielts: "6.5 overall (min. 5.5 in each element)",
    toefl: "87 (iBT; min. 17 listening, 18 reading, 17 speaking, 20 writing)",
    extra: "PTE 58 (42 each)",
    note: "Lancaster University English language requirements: undergraduate IELTS 6.5 overall with a minimum of 5.5 in each element, or TOEFL iBT 87 (min. 17 listening, 18 reading, 17 speaking, 20 writing); many postgraduate programmes require 6.5 with 6.0 in each skill.",
    source: "lancaster.ac.uk/study/entry-requirements/undergraduate-english-requirements",
  },
  {
    match: ["Wisconsin, Madison"],
    ielts: "6.5+",
    toefl: "80 (iBT) first-year; 80–91 graduate",
    extra: "Duolingo 115",
    note: "University of Wisconsin–Madison English proficiency: minimum accepted IELTS 6.5, TOEFL iBT 80 for first-year applicants (80–91 for graduate programs, per program), or Duolingo 115. Wisconsin does not accept 'MyBest' TOEFL scores.",
    source: "admissions.wisc.edu/international",
  },
  {
    match: ["Carnegie Mellon"],
    ielts: "7.5 overall (undergraduate); graduate varies by program",
    toefl: "102 (iBT; subscores 25+ considered)",
    extra: "Duolingo 120+",
    note: "Carnegie Mellon University English proficiency: undergraduate applicants need IELTS 7.5 overall or TOEFL iBT 102 (subscores of 25+ given consideration); graduate requirements vary by department (e.g. ECE requires IELTS 7.0 / TOEFL 86).",
    source: "cmu.edu/admission/admission/international-applicants",
  },
  {
    match: ["Macquarie"],
    ielts: "6.5 overall (min. 6.0 in each band)",
    toefl: "90 (iBT; min. 22 in each section)",
    extra: "PTE 64",
    note: "Macquarie University English language requirements: IELTS Academic 6.5 overall with no band less than 6.0, TOEFL iBT 90 with a minimum of 22 in each section, or PTE 64. Some courses require higher scores.",
    source: "mq.edu.au/study/admissions-and-entry/apply/international/english-language-requirements",
  },
  {
    match: ["Michigan State"],
    ielts: "6.5 (min. 6.0 in each band)",
    toefl: "79 (iBT; no subscore below 17)",
    extra: "Duolingo 110 (regular admission)",
    note: "Michigan State University English proficiency: regular admission requires TOEFL iBT 79 with no subscore below 17 (60–78 provisional), IELTS 6.5 with no subscore below 6.0, or Duolingo 110. Graduate programs follow the Graduate School's standard.",
    source: "admissions.msu.edu/apply/international/language-requirements",
  },
  {
    match: ["University of Central Missouri"],
    ielts: "5.5 (undergraduate)",
    toefl: "61 (iBT, undergraduate)",
    extra: "Duolingo 95",
    note: "University of Central Missouri English proficiency (undergraduate): TOEFL iBT 61, IELTS Academic 5.5, or Duolingo 95; graduate programs require higher scores (typically TOEFL 79–80 / IELTS 6.0–6.5).",
    source: "ucmo.edu/future-students/admissions/international-admissions",
  },
  {
    match: ["University of Ottawa"],
    ielts: "6.5 overall (6.5 writing, no section below 6.0)",
    toefl: "86 (iBT; min. 24 writing)",
    note: "University of Ottawa English language requirements: IELTS Academic 6.5 overall with 6.5 in writing and no section below 6.0, or TOEFL iBT 86 with a minimum of 24 in writing. French-language programs require DELF/DALF instead.",
    source: "uottawa.ca/study/undergraduate-studies/language-requirements",
  },
  {
    match: ["Algoma"],
    ielts: "6.5 overall (no band below 6.0)",
    toefl: "90 (iBT)",
    note: "Algoma University English language proficiency: IELTS Academic 6.5 overall with no band below 6.0, TOEFL iBT 90, Duolingo 95–110 (program dependent), or CAEL 60; certain English-medium study may waive the requirement.",
    source: "algomau.ca/admissions/admissions-requirements/english-language-requirements",
  },
  {
    match: ["University of Sheffield"],
    ielts: "6.5 overall (min. 6.0 in each component)",
    toefl: "88 (iBT)",
    note: "University of Sheffield English language requirements: undergraduate IELTS 6.5 with 6.0 in each component (some courses 6.0/5.5); postgraduate courses typically require IELTS 6.5–7.0 with 6.0 in each component. Equivalent TOEFL iBT 88 (or 80 for 6.0-equivalent courses).",
    source: "sheffield.ac.uk/international/entry-requirements/english-language-requirements",
  },
  {
    match: ["University of Calgary"],
    ielts: "6.5 overall (no section less than 6.0)",
    toefl: "86 (iBT, graduate); 80+ undergraduate",
    extra: "Duolingo 120 (undergraduate)",
    note: "University of Calgary English language requirements: IELTS Academic 6.5 with no section less than 6.0, or TOEFL iBT 86 (graduate standard; undergraduate typically 80+ with Duolingo 120). Some graduate faculties require higher scores.",
    source: "ucalgary.ca/future-students/undergraduate/admissions/how-to-apply/english-language-requirements",
  },
  {
    match: ["University of Lethbridge"],
    ielts: "6.5 overall (min. 6.0 in each band)",
    toefl: "86 (iBT; min. 20 in each section)",
    extra: "PTE 61; Duolingo 115",
    note: "University of Lethbridge English language proficiency: IELTS Academic 6.5 overall with a minimum of 6.0 in each band, TOEFL iBT 86 with a minimum of 20 in each section, PTE 61, or Duolingo 115; graduate programs typically require TOEFL 86 / IELTS 6.5 (some 7.0).",
    source: "ulethbridge.ca/ross/admissions/elp",
  },
  {
    match: ["University of Windsor"],
    ielts: "6.5 overall (no more than one band 6.0)",
    toefl: "83 (iBT)",
    extra: "Duolingo 120",
    note: "University of Windsor English proficiency: IELTS Academic 6.5 overall with no more than one band score of 6.0 and no individual band below 6.0, TOEFL iBT 83, or Duolingo 120; graduate programs vary (some require IELTS 7.0 / TOEFL 100).",
    source: "uwindsor.ca/registrar/498/undergraduate-admission-requirements",
  },
  {
    match: ["New Jersey Institute of Technology"],
    ielts: "6.5 (graduate); 6.0 (undergraduate)",
    toefl: "79 (iBT)",
    extra: "Duolingo 120 (graduate) / 100 (undergraduate)",
    note: "NJIT English proficiency: graduate applicants need TOEFL iBT 79 or IELTS 6.5 (no subscore lower than 6.0), Duolingo 120; undergraduate applicants need TOEFL iBT 79 or IELTS 6.0, Duolingo 100. PTE also accepted.",
    source: "njit.edu/graduate-international-admissions-process",
  },
  {
    match: ["Washington State University"],
    ielts: "6.5",
    toefl: "79 (iBT); 75+ some programs",
    extra: "Duolingo 105",
    note: "Washington State University English proficiency: IELTS Academic 6.5, TOEFL iBT 79 (some programs accept 75+), or Duolingo 105; graduate programs follow the Graduate School standard (e.g. English dept. requires TOEFL 93 / IELTS 7.0).",
    source: "gradschool.wsu.edu/international-requirements",
  },
  {
    match: ["University of Essex"],
    ielts: "6.0 (undergraduate) / 6.5 (postgraduate)",
    toefl: "80 (undergraduate) / 88 (postgraduate)",
    note: "University of Essex English language requirements: undergraduate courses require IELTS 6.0 overall with a minimum of 5.5 in each component (TOEFL iBT 80); most postgraduate courses require IELTS 6.5 with 5.5–6.0 in each component (TOEFL iBT 88). Specific courses may vary.",
    source: "essex.ac.uk/international/applying-to-essex",
  },
];

async function main() {
  const now = new Date();
  let total = 0, langFilled = 0, noted = 0;
  for (const pol of POLICIES) {
    const conds = pol.match.map((_, i) => `u.name ILIKE '%' || $${i + 1} || '%'`).join(" OR ");
    const rows = await p.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT s.id, s."languageRequirements", s.description
       FROM "Scholarship" s JOIN "University" u ON s."universityId" = u.id
       WHERE s.status = 'ACTIVE' AND (${conds})`,
      ...pol.match
    );
    console.log(`\n=== ${pol.match[0]}: ${rows.length} records ===`);

    let lang = 0, note = 0;
    for (const r of rows) {
      const id = r.id as string;
      const langRaw = (r.languageRequirements as string) || "";
      const data: Record<string, unknown> = { lastVerifiedAt: now };

      const meaningful =
        langRaw && langRaw !== "[]" && langRaw !== "{}" &&
        (langRaw.includes('"ielts":true') || langRaw.includes('"toefl":true') ||
         langRaw.includes('"noIelts":true') || langRaw.includes('"notRequired":true'));
      if (!meaningful) {
        data.languageRequirements = JSON.stringify({
          ielts: true, toefl: true, noIelts: false, altProof: true, notRequired: false,
        });
        lang++;
      }

      const desc = (r.description as string) || "";
      const sig = pol.note.slice(0, 60);
      if (!desc.includes(sig)) {
        data.description = `${desc}\n\n${pol.note}\nSource: ${pol.source}.`.trim();
        note++;
      }

      if (Object.keys(data).length > 1) {
        await p.scholarship.update({ where: { id }, data });
        langFilled += lang > 0 ? 1 : 0;
        noted += note > 0 ? 1 : 0;
      }
    }
    total += rows.length;
    langFilled += lang;
    noted += note;
  }
  console.log(`\nDone: ${total} records seen, language filled on ${langFilled}, notes appended on ${noted}`);
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
