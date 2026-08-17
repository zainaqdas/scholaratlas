/**
 * Backfill English-language requirements for non-China universities from their
 * official English-language-requirements pages (verified August 2026).
 *
 * Semantics: every university listed here teaches in English and requires
 * international applicants whose first language is not English to prove
 * proficiency (IELTS / TOEFL, with alternatives like PTE or Duolingo).
 * So the flags are ielts:true, toefl:true, altProof:true, noIelts:false.
 * The specific scores are recorded in the note with the source URL.
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

interface Policy {
  match: string[]; // university-name LIKE patterns
  ielts: string;
  toefl: string;
  extra?: string; // e.g. PTE / Duolingo scores
  note: string;
  source: string;
}

const POLICIES: Policy[] = [
  {
    match: ["University of Waterloo"],
    ielts: "6.5 overall (6.5 writing, 6.5 speaking, 6.0 reading, 6.0 listening)",
    toefl: "90 (25 writing, 25 speaking)",
    extra: "PTE Academic 63 overall (65 writing, 65 speaking); Cambridge C1/C2 180",
    note: "English language requirements for international applicants at the University of Waterloo: IELTS Academic 6.5 overall (6.5 writing, 6.5 speaking, 6.0 reading, 6.0 listening), TOEFL iBT 90 (25 writing, 25 speaking), PTE Academic 63 (65 writing/speaking), or Cambridge C1/C2 180. IELTS One Skill Retake accepted.",
    source: "uwaterloo.ca/future-students/admissions/english-language-requirements",
  },
  {
    match: ["University of Melbourne"],
    ielts: "6.5 overall (6.0 in each band)",
    toefl: "81 (19 writing, 19 speaking, 16 reading, 16 listening)",
    extra: "PTE 64 (60 in each); Cambridge C1 169",
    note: "Standard undergraduate English requirement at the University of Melbourne (UoM Level 1): IELTS Academic 6.5 overall with 6.0 in each band, TOEFL iBT 81 (19 writing, 19 speaking, 16 reading, 16 listening), PTE Academic 64 (60 in each), or Cambridge C1 Advanced 169. Some courses require higher scores.",
    source: "study.unimelb.edu.au/how-to-apply/english-language-requirements",
  },
  {
    match: ["University of Auckland"],
    ielts: "6.0 overall (no band below 5.5) undergraduate; 6.5 (no band below 6.0) postgraduate",
    toefl: "80 (writing 21) undergraduate; 90 (writing 21) postgraduate",
    extra: "PTE 50 undergraduate / 58 postgraduate",
    note: "University of Auckland English requirements: undergraduate IELTS 6.0 overall with no band below 5.5 or TOEFL iBT 80 (writing 21); postgraduate IELTS 6.5 with no band below 6.0 or TOEFL iBT 90 (writing 21). IELTS One Skill Retake accepted. Programme pages specify the exact score.",
    source: "auckland.ac.nz/en/study/applications-and-admissions/entry-requirements",
  },
  {
    match: ["Indiana Institute of Technology"],
    ielts: "6.0",
    toefl: "70 (iBT)",
    extra: "PTE 51; Duolingo 95–105",
    note: "Indiana Tech English proficiency requirements for international students: TOEFL iBT 70, IELTS 6.0, PTE 51, or Duolingo English Test 95 (graduate) / 105 (undergraduate and graduate). Waived for students from English-speaking countries.",
    source: "international.indianatech.edu/requirements/english-proficiency",
  },
  {
    match: ["Tulane University"],
    ielts: "6.5+ (typical)",
    toefl: "95+ (iBT, typical)",
    note: "Tulane University requires proof of English proficiency for international applicants. Successful applicants typically score 95+ on TOEFL iBT or 6.5+ on IELTS; graduate programmes may set higher minimums (e.g. 100 TOEFL / 7.0 IELTS). Check the specific programme.",
    source: "admission.tulane.edu/international",
  },
  {
    match: ["Brock University"],
    ielts: "6.5 overall (no band below 6.0)",
    toefl: "88 (no subtest below 21)",
    note: "Brock University English proficiency requirements: IELTS Academic 6.5 overall with no band below 6.0, or TOEFL iBT 88 with no subtest below 21 (standard undergraduate and graduate minimum).",
    source: "brocku.ca/admissions/english-proficiency",
  },
  {
    match: ["RMIT University"],
    ielts: "6.5 overall (no band less than 6.0) typical",
    toefl: "79–94 (iBT, by course)",
    note: "RMIT English requirements vary by course: most bachelor and master programmes require IELTS Academic 6.5 overall with no band less than 6.0 or TOEFL iBT 79–94; some courses require higher scores. Check the specific course.",
    source: "rmit.edu.au/study-with-us/international-students/apply-to-rmit-international-students/entry-requirements/english-requirements",
  },
  {
    match: ["Kelley School of Business"],
    ielts: "6.5 (undergraduate) / 7.0 (MBA)",
    toefl: "80 (undergraduate) / 100 (MBA)",
    extra: "Duolingo 130 (MBA)",
    note: "Kelley School of Business (Indiana University) English requirements: undergraduate applicants need TOEFL 80 or IELTS 6.5 (or PTE 55); the Full-Time MBA requires TOEFL iBT 100, IELTS 7.0, or Duolingo 130.",
    source: "kelley.iu.edu/programs/full-time-mba/admissions/international-applicants.html",
  },
  {
    match: ["Lakehead University"],
    ielts: "6.5 overall (no individual band less than 6.0)",
    toefl: "80 (no component less than 19)",
    extra: "Cambridge C1 176 (no score less than 169)",
    note: "Lakehead University English language proficiency requirements: IELTS 6.5 overall with no individual band less than 6.0, TOEFL iBT 80 with no component less than 19, or Cambridge C1 Advanced 176 (no score less than 169).",
    source: "lakeheadu.ca/studentcentral/applying/english-language-proficiency-requirements",
  },
  {
    match: ["Yukon University"],
    ielts: "6.0 (no band lower than 6.0)",
    toefl: "79 (iBT)",
    note: "Yukon University English proficiency: IELTS Academic 6.0 overall with no band lower than 6.0 (bachelor's, diploma and certificate programmes) or TOEFL iBT 79.",
    source: "yukonu.ca/international/future-students/admission",
  },
  {
    match: ["University of Queensland"],
    ielts: "6.5 overall (6.0 in all sub-bands)",
    toefl: "87 (iBT, typical)",
    note: "University of Queensland minimum English requirement: overall IELTS 6.5 with 6.0 in all sub-bands (or equivalent, including IELTS One Skill Retake) for most programs; some programs require higher scores. TOEFL iBT and PTE Academic equivalents accepted.",
    source: "future-students.uq.edu.au/admissions/english-language-requirements",
  },
  {
    match: ["Lewis University"],
    ielts: "6.5",
    toefl: "79 (iBT)",
    extra: "PTE 52; Duolingo 105",
    note: "Lewis University English proficiency requirements for international admission: TOEFL iBT 79, IELTS 6.5, PTE Academic 52, or Duolingo 105. Graduate programmes: TOEFL iBT 79 (writing 20) or IELTS 6.0 (writing 6.0).",
    source: "lewisu.edu/admissions/international/english-proficiency-requirements.htm",
  },
  {
    match: ["Australian National University"],
    ielts: "6.5 overall (min. 6.0 in each subtest)",
    toefl: "80 (iBT, typical)",
    note: "ANU standard English language requirement: IELTS Academic 6.5 overall with a minimum of 6.0 in each subtest, or TOEFL iBT 80 (typical). Some programs require higher scores. IELTS Academic One Skill Retake accepted.",
    source: "policies.anu.edu.au/ppl/document/ANUP_000408",
  },
  {
    match: ["Northeastern University"],
    ielts: "6.5",
    toefl: "79 (iBT)",
    extra: "Duolingo 105",
    note: "Northeastern University English proficiency (typical minimum): TOEFL iBT 79, IELTS 6.5, or Duolingo 105. Undergraduate and graduate programmes accept Cambridge English, PTE Academic, and other tests; some programmes require higher scores.",
    source: "northeastern.edu / husky.my.site.com",
  },
  {
    match: ["University of Canterbury"],
    ielts: "6.0 (min. 5.5 in each band) undergraduate; 6.5 (min. 6.0) postgraduate",
    toefl: "iBT equivalent per level",
    note: "University of Canterbury English requirements: undergraduate IELTS Academic 6.0 with a minimum of 5.5 in each band; postgraduate (Level 1) IELTS Academic 6.5 with a minimum of 6.0 in each band. TOEFL iBT and other tests accepted at equivalent scores.",
    source: "canterbury.ac.nz/study/getting-started/admission-and-enrolment/enrolment-topics/english-language-proficiency",
  },
  {
    match: ["University College Cork"],
    ielts: "6.5 overall (min. 6.0 in each band)",
    toefl: "90 (iBT, typical)",
    note: "UCC English language requirements: IELTS 6.5 overall with a minimum of 6.0 in each band, or TOEFL iBT 90 (typical) for most programmes; some programmes require higher scores. Undergraduate minimum is IELTS 6.0 (no band lower than 5.5) for certain courses.",
    source: "ucc.ie/en/study/comparison/english",
  },
  {
    match: ["Mississippi State University"],
    ielts: "6.0",
    toefl: "71 (iBT)",
    note: "Mississippi State English proficiency (undergraduate): TOEFL iBT 71 or IELTS 6.0; some departments require higher scores. Graduate programmes typically require TOEFL 79–80 or IELTS 6.5.",
    source: "admissions.msstate.edu/apply/admission-process/international",
  },
  {
    match: ["Georgia State University"],
    ielts: "6.0",
    toefl: "69 (iBT)",
    note: "Georgia State University English proficiency (undergraduate): TOEFL iBT 69, IELTS Academic 6.0, PTE 58, or Duolingo 95. Graduate programmes typically require higher scores (e.g. 100 TOEFL / 7.0 IELTS in some colleges).",
    source: "admissions.gsu.edu/bachelors-degree/apply/int-first-years",
  },
  {
    match: ["State University of New York at Buffalo"],
    ielts: "6.0 (undergraduate) / 6.5 (graduate)",
    toefl: "70 (undergraduate) / 79 (graduate)",
    extra: "Duolingo 105",
    note: "University at Buffalo (SUNY) English proficiency: undergraduate TOEFL iBT 70 or IELTS 6.0 (Duolingo 105); graduate TOEFL iBT 79 or IELTS 6.5. Law requires TOEFL 90 / IELTS 7.0+; some programmes set higher minimums.",
    source: "buffalo.edu/admissions/apply/international",
  },
  {
    match: ["George Brown College"],
    ielts: "6.0 (min. 5.5 in each skill band)",
    toefl: "80 (online, min. 20 in each)",
    note: "George Brown College English proficiency for international applicants: IELTS Academic 6.0 with a minimum of 5.5 in each skill band, or TOEFL 80 (online) with a minimum of 20 in each skill; other tests (PTE, Duolingo) also accepted.",
    source: "georgebrown.ca/apply/admission-requirements/english-proficiency",
  },
  {
    match: ["University of Hertfordshire"],
    ielts: "6.0 (no band below 5.5) undergraduate; 6.5 (no band below 5.5) postgraduate",
    toefl: "equivalent accepted",
    note: "University of Hertfordshire English requirements: IELTS 6.0 with no less than 5.5 in any band for undergraduate, or 6.5 with no less than 5.5 in any band for postgraduate; some courses require higher scores. TOEFL and PTE equivalents accepted.",
    source: "herts.ac.uk/international/apply/application-requirements",
  },
  {
    match: ["Florida State University"],
    ielts: "6.5",
    toefl: "80 (iBT)",
    note: "Florida State University English proficiency requirements: TOEFL iBT 80 (paper-based 550) or IELTS Academic 6.5. Graduate and undergraduate minimums are the same; some departments require higher scores.",
    source: "admissions.fsu.edu/international/english-proficiency",
  },
  {
    match: ["Swinburne University"],
    ielts: "6.5 overall (no band below 6.0) typical",
    toefl: "79 (iBT, no band below 18) typical",
    note: "Swinburne English requirements vary by course: most programmes require IELTS 6.5 overall with no band below 6.0, or TOEFL iBT 79 with no individual band below 18; some courses require higher scores. Check the specific course.",
    source: "swinburne.edu.au/study/international/apply/entry-requirements",
  },
  {
    match: ["University of Southampton"],
    ielts: "6.5 overall (min. 6.0 in each component)",
    toefl: "92 (iBT, typical)",
    note: "University of Southampton English language requirements: IELTS 6.5 overall with a minimum of 6.0 in each component (typical), or TOEFL iBT 92 (22 reading, 21 listening, 23 speaking, 21 writing typical); some programmes require higher scores.",
    source: "southampton.ac.uk/international/english-language-requirements",
  },
  {
    match: ["Singapore University of Technology and Design"],
    ielts: "6.5",
    toefl: "90 (iBT)",
    note: "SUTD English proficiency requirement: TOEFL iBT 90 or IELTS 6.5 (minimum). SAT, PTE Academic, ACT or C1 Advanced also accepted; waived if the medium of instruction was English.",
    source: "sutd.edu.sg/admissions/undergraduate/criteria-for-admission",
  },
  {
    match: ["University of Michigan"],
    ielts: "7.0 (typical)",
    toefl: "100 (iBT, 23+ listening & reading, 21+ speaking & writing)",
    note: "University of Michigan English proficiency: TOEFL iBT 100 with section scores 23+ in listening and reading and 21+ in speaking and writing (typical); IELTS 7.0 (6.5 for some graduate programmes). Some schools require higher scores.",
    source: "admissions.umich.edu/apply/international-applicants/exams-visas",
  },
  {
    match: ["Victoria University of Wellington"],
    ielts: "6.0 (no band lower than 5.5) undergraduate; 6.5 (no band lower than 6.0) postgraduate",
    toefl: "80 (undergraduate) / 90 (postgraduate)",
    note: "Victoria University of Wellington English requirements: undergraduate IELTS 6.0 overall with no band lower than 5.5 or TOEFL iBT 80; standard postgraduate IELTS 6.5 with no band lower than 6.0 or TOEFL iBT 90. PTE 50/58 equivalents.",
    source: "wgtn.ac.nz/international/applying/entry-requirements/english-language",
  },
  {
    match: ["The University of Sydney"],
    ielts: "6.5 overall (no band below 6.0)",
    toefl: "85 (iBT, typical)",
    note: "University of Sydney standard English requirement: IELTS overall score of 6.5 with no band below 6.0; TOEFL iBT 85 (typical, varies by course). Some courses (e.g. education, law, MBA) require higher scores.",
    source: "sydney.edu.au/study/applying/how-to-apply/international-students/english-language-requirements.html",
  },
  {
    match: ["University of Massachusetts Dartmouth"],
    ielts: "6.0",
    toefl: "79 (iBT) undergraduate / 72 (iBT) graduate",
    extra: "PTE 52; Duolingo 110",
    note: "UMass Dartmouth English proficiency: undergraduate TOEFL iBT 79 or IELTS 6.0 (Duolingo 105+); graduate TOEFL iBT 72 or IELTS 6.0 (PTE 52, Duolingo 110). Some graduate programmes require higher scores.",
    source: "umassd.edu/graduate/international-students/language-test-waiver",
  },
  {
    match: ["San Jose State University"],
    ielts: "6.5 (graduate)",
    toefl: "80 (iBT, graduate)",
    note: "San Jose State University English proficiency: graduate programmes require TOEFL iBT 80 or IELTS 6.5 (some programmes vary); undergraduate standards are set per programme on the new TOEFL 1–6 scale. Other tests (PTE, Duolingo) accepted.",
    source: "sjsu.edu/admissions",
  },
  {
    match: ["Red River College"],
    ielts: "6.0 (no band below 6.0)",
    toefl: "75–76 (iBT)",
    note: "Red River College Polytech English language requirements: IELTS Academic 6.0 overall with no band below 6.0, or TOEFL iBT 75–76 (programme-dependent); PTE 50 also accepted.",
    source: "catalogue.rrc.ca/Information/ELR",
  },
  {
    match: ["University of New South Wales"],
    ielts: "6.5 overall (min. 6.0 in each subtest) typical",
    toefl: "90 (iBT, typical)",
    note: "UNSW English requirements vary by faculty: most programmes require IELTS 6.5 overall with a minimum of 6.0 in each subtest, or TOEFL iBT 90 (23 writing, 22 reading/listening/speaking); business and law research programmes require 6.5 (6.5 writing).",
    source: "unsw.edu.au/study/how-to-apply/english-language-requirements",
  },
  {
    match: ["University of Saskatchewan"],
    ielts: "6.5 overall (min. 6.0 in each band)",
    toefl: "86 (iBT, min. 19 in each)",
    note: "University of Saskatchewan English requirements: IELTS Academic 6.5 overall with minimum individual scores of 6.0 in each band, or TOEFL iBT 86 with a minimum of 19 in each; CAE 176 and PTE 63 equivalents accepted.",
    source: "admissions.usask.ca/requirements/english-language-proficiency.php",
  },
  {
    match: ["Georgia Institute of Technology"],
    ielts: "7.0 (reading 6.5+)",
    toefl: "90 (iBT, 19+ per section)",
    note: "Georgia Tech graduate English proficiency: TOEFL iBT 90 or higher (19+ per section), or IELTS Academic 7.0 or higher (reading 6.5+). TOEFL Essentials, IELTS General Training, Duolingo and PTE are not accepted for graduate admission.",
    source: "grad.gatech.edu/english-proficiency",
  },
  {
    match: ["Concordia University"],
    ielts: "6.0 (no component under 5.5)",
    toefl: "70 (iBT)",
    extra: "Duolingo 105; PTE 50; CAEL 50",
    note: "Concordia University English proficiency (undergraduate): TOEFL iBT 70, IELTS 6.0 with no component under 5.5, Duolingo 105, CAEL 50, or PTE 50 (minimum 46 in each). Graduate programmes typically require higher scores.",
    source: "concordia.ca/admissions/undergraduate/requirements/english-language-proficiency.html",
  },
];

async function main() {
  const now = new Date();
  let total = 0, langFilled = 0, noted = 0;
  for (const pol of POLICIES) {
    const conds = pol.match.map((_, i) => `u.name ILIKE '%' || $${i + 1} || '%'`).join(" OR ");
    const rows = await p.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT s.id, s."languageRequirements", s.description, s."studyLevels"
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
      // Only fill when there is no meaningful language data yet.
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
      }
    }
    console.log(`  language: ${lang}  note: ${note}`);
    total += rows.length; langFilled += lang; noted += note;
  }
  console.log(`\nTOTAL: ${total} records, ${langFilled} language filled, ${noted} notes appended`);
  await p.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
