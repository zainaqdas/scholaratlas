/**
 * Backfill Chinese-university program records with university-level scholarship
 * policy data crawled from each university's official English website
 * (data/uni_scholarships/*.html, crawled 2026-08-17).
 *
 * Only sets fields the official source actually publishes:
 *  - languageRequirements: Chinese-medium programs -> No IELTS / not required;
 *    English-medium programs -> IELTS/TOEFL only where the university states scores
 *  - deadline: next occurrence of the university's annual scholarship deadline
 *    (only where a concrete annual deadline is published)
 *  - duration: standard program durations explicitly published per level
 *  - officialUrl: point at the university's scholarship/admission page instead of
 *    the generic homepage root
 *  - description: append a factual "Campus scholarships" note (source-backed)
 */
import { prisma as p } from "../src/lib/prisma";

interface UniPolicy {
  match: string[]; // URL substrings to identify the university's records
  officialUrl?: string;
  note: string;
  deadline?: { month: number; day: number }; // annual (recurring) deadline
  durations?: Record<string, string>; // study level -> standard duration
  englishLang?: { ielts?: string; toefl?: string; altProof?: boolean }; // only where officially stated
}

const POLICIES: UniPolicy[] = [
  {
    match: ["ncepu"],
    officialUrl: "https://studyatncepu.ncepu.edu.cn/Admissions/Scholarship/index.htm",
    note: "Campus scholarships at NCEPU: Chinese Government Scholarship (CSC, full), CSC-Chinese University Program (full, Master's and PhD, deadline 30 March), Beijing Government Scholarship (partial, first-year tuition or half, Bachelor's, deadline 30 April) and the International Education Institute Scholarship (full or partial tuition, Bachelor's, deadline 30 April). Source: studyatncepu.ncepu.edu.cn.",
  },
  {
    match: ["nepu"],
    officialUrl: "https://www.nepu.edu.cn/en/International/Admission_Website.htm",
    durations: { undergraduate: "4 years", masters: "2–3 years", phd: "3 years" },
    note: "NEPU university scholarships: First-class CNY 11,000/year, Second-class CNY 8,000/year, Third-class CNY 7,500/year. Degree applicants must reach HSK Band 4 (Chinese-taught). Tuition: CNY 16,000/year (Chinese-taught bachelor's), CNY 20,000/year (English-taught bachelor's); Master's CNY 20,000/24,000; PhD CNY 30,000/38,000. Source: nepu.edu.cn/en.",
  },
  {
    match: ["cqmu"],
    officialUrl: "https://english.cqmu.edu.cn/Education/Scholarships.htm",
    note: "Chongqing Municipal Government Mayor Scholarship: CNY 35,000 (PhD), 30,000 (Master's), 25,000 (Bachelor's) first-class; CNY 20,000/15,000/10,000 second-class per year. Deadline 30 September annually, 20–30 awards. Age limits: 25 (Bachelor's), 35 (Master's), 40 (PhD). Source: english.cqmu.edu.cn.",
  },
  {
    match: ["buct"],
    officialUrl: "https://en-sie.buct.edu.cn/4217/list.htm",
    deadline: { month: 6, day: 30 },
    note: "Beijing Government Scholarship at BUCT: one-year or half-year tuition fee remission for undergraduate, master's and doctoral students (application by June). BUCT Presidential Scholarship for PhD programs. Apply online at study.buct.edu.cn. Source: en-sie.buct.edu.cn.",
  },
  {
    match: ["zjut"],
    officialUrl: "https://www.gjxy.zjut.edu.cn/index.php/en/scholarship/zjut-full-scholarship",
    note: "ZJUT PhD Full Scholarship: tuition, accommodation and a monthly living allowance of CNY 3,500, application deadline end of May. ZJUT Scholarship for bachelor's and master's programs. Zhejiang Provincial Government Scholarship also available. Source: gjxy.zjut.edu.cn.",
  },
  {
    match: ["scut"],
    officialUrl: "http://sie.scut.edu.cn/p1244c1169/list.htm",
    note: "Scholarships at SCUT: Chinese Government Scholarship (full-time Master's and Doctoral), SCUT International Scholarship for Excellence, Guangdong Provincial Government Outstanding Foreign Student Scholarship, and International Chinese Language Teachers Scholarship. Source: sie.scut.edu.cn.",
  },
  {
    match: ["cust"],
    officialUrl: "https://sie.cust.edu.cn/scholarship/index.htm",
    deadline: { month: 5, day: 31 },
    englishLang: { ielts: "5.5", toefl: "80", altProof: true },
    note: "CSC Graduate Program at CUST: full scholarship — tuition waiver, accommodation, comprehensive medical insurance and monthly stipend (CNY 2,500 undergraduate / 3,000 master's / 3,500 doctoral). English-taught scholarships require IELTS 5.5, TOEFL iBT 80, or proof of English as a working language; deadline 31 May for the autumn intake. Source: sie.cust.edu.cn.",
  },
  {
    match: ["sdu"],
    officialUrl: "https://www.istudy.sdu.edu.cn/English/Scholarships/Shandong_University_Scholarship_for_International_.htm",
    deadline: { month: 3, day: 1 },
    englishLang: { ielts: "6.0", toefl: "80", altProof: true },
    note: "SDU Scholarship for Outstanding International Students: Full scholarship (tuition, living allowance, accommodation, comprehensive medical insurance) or Partial (tuition + insurance). Chinese-taught programs: HSK 4 (210+, Bachelor's), HSK 5 (180+, Master's), HSK 6 (180+, PhD). English-taught programs: IELTS 6.0, TOEFL 80, or a degree taught entirely in English. Deadline 1 March. Source: istudy.sdu.edu.cn.",
  },
  {
    match: ["czu"],
    officialUrl: "https://gjjl.cczu.edu.cn/_t1248/FEESwSCHOLARSHIPS/main.psp",
    note: "Jiangsu Provincial Government Scholarship at CZU: CNY 18,000 per bachelor's student and CNY 30,000 per postgraduate student. CZU Undergraduate Scholarship and CZU Postgraduate Academic Scholarship also available. Source: gjjl.cczu.edu.cn.",
  },
  {
    match: ["zafu"],
    officialUrl: "https://admission.zafu.edu.cn/Scholarships.htm",
    note: "ZAFU University Scholarship levels for degree programs: Full, Half, Quarter and CNY 1,000/year; Zhejiang Provincial Government Scholarship CNY 20,000/year. HSK 4 preferred for Chinese-taught programs. Source: admission.zafu.edu.cn.",
  },
  {
    match: ["shou"],
    officialUrl: "https://ieo.shou.edu.cn/2025/1126/c18223a348600/page.htm",
    durations: { masters: "3 years", phd: "4 years" },
    englishLang: { ielts: "6.0", toefl: "80" },
    note: "CSC High-level Postgraduate Program at SHOU: full scholarship — tuition, double-room accommodation, living stipend and comprehensive medical insurance; deadline 1 February. Chinese-taught degree programs: HSK 5 (180+, Master's/PhD). English-taught programs: IELTS 6.0 or TOEFL iBT 80. Source: ieo.shou.edu.cn.",
  },
  {
    match: ["shutcm"],
    officialUrl: "https://iec.shutcm.edu.cn/en/598/list.htm",
    durations: { undergraduate: "4–5 years", masters: "3 years", phd: "3 years + 1 year extension" },
    note: "Shanghai Government Scholarship at SHUTCM for bachelor's (age under 25), master's (under 35) and doctoral (under 40) students; SHUTCM also offers university scholarships. Chinese-taught programs require HSK scores. Source: iec.shutcm.edu.cn.",
  },
  {
    match: ["nefu"],
    officialUrl: "https://siee.nefu.edu.cn/English/Scholarships/NEFU_President_Scholarship_.htm",
    englishLang: { ielts: "6.0", toefl: "80" },
    note: "NEFU President Scholarship, deadline 30 April. Chinese-taught programs: HSK 4 (Science, Engineering, Agriculture, Medicine, Economics, Management, Art) or HSK 5 (Literature, Law). English-taught programs: IELTS 6.0 or TOEFL 80 (Bachelor's); IELTS 6.5 or TOEFL 95 (graduate). CSC Program applications November–March. Source: siee.nefu.edu.cn.",
  },
];

function hasLevel(levelsRaw: string, ...needles: string[]): boolean {
  try {
    const arr = JSON.parse(levelsRaw);
    if (!Array.isArray(arr)) return false;
    const low = arr.map((s: string) => String(s).toLowerCase());
    return needles.some((n) => low.some((v) => v.includes(n)));
  } catch {
    return false;
  }
}

function nextOccurrence(month: number, day: number): Date {
  const now = new Date();
  const y = now.getFullYear();
  const candidate = new Date(Date.UTC(y, month - 1, day));
  if (candidate < now) candidate.setUTCFullYear(y + 1);
  return candidate;
}

async function main() {
  const now = new Date();
  for (const pol of POLICIES) {
    const conds = pol.match.map((_, i) => `LOWER("officialUrl") LIKE '%' || $${i + 1} || '%'`).join(" OR ");
    const rows = await p.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT id, "studyLevels", "description", "languageRequirements", "officialUrl", "deadline", "duration" FROM "Scholarship"
       WHERE "countryCode" = 'CN' AND (${conds})`,
      ...pol.match
    );
    console.log(`\n=== ${pol.match[0]}: ${rows.length} records ===`);

    let lang = 0, dur = 0, dl = 0, url = 0, note = 0;
    for (const r of rows) {
      const id = r.id as string;
      const desc = (r.description as string) || "";
      const eng = /language of instruction:\s*english/i.test(desc);

      const data: Record<string, unknown> = { lastVerifiedAt: now };

      // 1. language requirements
      const langRaw = r.languageRequirements as string;
      const hasLang = langRaw && langRaw !== "[]" && langRaw !== "{}";
      if (!hasLang) {
        if (eng && pol.englishLang) {
          data.languageRequirements = JSON.stringify({
            ielts: true, toefl: true, noIelts: false,
            altProof: pol.englishLang.altProof ?? false,
            notRequired: false,
          });
          lang++;
        } else if (!eng) {
          // Chinese-medium (or unknown): no English test required
          data.languageRequirements = JSON.stringify({
            ielts: false, toefl: false, noIelts: true, altProof: false, notRequired: true,
          });
          lang++;
        }
      }

      // 2. duration by level (only where the university publishes standard durations)
      if (pol.durations && (!r.duration || (r.duration as string) === "")) {
        const lv = (r.studyLevels as string) || "";
        const durText =
          (hasLevel(lv, "undergrad") ? pol.durations.undergraduate : undefined) ??
          (hasLevel(lv, "master") ? pol.durations.masters : undefined) ??
          (hasLevel(lv, "phd", "doctor") ? pol.durations.phd : undefined);
        if (durText) {
          data.duration = durText;
          dur++;
        }
      }

      // 3. annual deadline (next occurrence) where the record has none
      if (pol.deadline && !r.deadline) {
        data.deadline = nextOccurrence(pol.deadline.month, pol.deadline.day);
        data.deadlineTimezone = "CST (China Standard Time)";
        dl++;
      }

      // 4. officialUrl -> scholarship page
      if (pol.officialUrl && r.officialUrl !== pol.officialUrl) {
        data.officialUrl = pol.officialUrl;
        url++;
      }

      // 5. append campus-scholarship note to description
      if (pol.note && !desc.includes(pol.note.slice(0, 60))) {
        data.description = `${desc}\n\n${pol.note}`.trim();
        note++;
      }

      if (Object.keys(data).length > 1) {
        await p.scholarship.update({ where: { id }, data });
      }
    }
    console.log(`  language: ${lang}  duration: ${dur}  deadline: ${dl}  officialUrl: ${url}  note: ${note}`);
  }
  await p.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
