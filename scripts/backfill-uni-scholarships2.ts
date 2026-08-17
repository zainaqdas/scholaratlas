/**
 * Backfill round 2 — the remaining zero-presence Chinese universities.
 * Same approach as scripts/backfill-uni-scholarships.ts: only set fields the
 * university's official English website publishes (data/uni_scholarships2/*).
 *
 * Skipped honestly: ZZULI (policy published only in Chinese), CCUT/NBU/ZUT
 * (no reachable English international-student site), BFA (WAF 412).
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

interface UniPolicy {
  match: string[];
  officialUrl?: string;
  note: string;
  deadline?: { month: number; day: number };
  durations?: Record<string, string>;
  englishLang?: { ielts?: string; toefl?: string; altProof?: boolean };
}

const POLICIES: UniPolicy[] = [
  {
    match: ["cumt"],
    officialUrl: "https://sac.cumt.edu.cn/english/ADMISSION/Fees___Scholarships.htm",
    englishLang: { ielts: "5.5", toefl: "70", altProof: true },
    note: "CUMT scholarships: Class A/B+/B/C university scholarships with GPA requirements (3.2/3.2/3.0/2.8) and age limits (25/35/40); Chinese Government Scholarship and Silk Road Scholarship also available. English-taught programs: IELTS 5.5, TOEFL 70 or Duolingo; Chinese-taught: HSK 4 (180+). Tuition CNY 13,800–17,000/year by level. Source: sac.cumt.edu.cn.",
  },
  {
    match: ["zjnu"],
    officialUrl: "https://iso.zjnu.edu.cn/whejiangwwormalwwniversitywwcholarshipwforwwutstandingwwnternationalwwtudents/list.htm",
    englishLang: { ielts: "stated", toefl: "stated", altProof: true },
    note: "ZJNU Scholarship for Outstanding Students: Type A (full tuition, no stipend), Type B (half tuition), Type C (CNY 4,500); CSC High-Level Postgraduate Program (full: tuition, accommodation, stipend and CNY 800 medical insurance). Chinese-taught: HSK certificate; English-taught: IELTS, TOEFL or GRE. Tuition CNY 18,000/year (undergraduate), 22,000–24,000 (Master's). Source: iso.zjnu.edu.cn.",
  },
  {
    match: ["zust"],
    officialUrl: "https://ies.zust.edu.cn/index/Quick_Pass_to_Application1/Scholarships1/Scholarship_for_Outstanding_New_Postgraduate_Stude.htm",
    note: "ZUST scholarships: the Special level covers tuition and accommodation for the first postgraduate year; levels 1–3 cover 100%/70%/50% of annual tuition; the ZUST Excellent Foreign Degree Student Scholarship supports bachelor's and master's students. Source: ies.zust.edu.cn.",
  },
  {
    match: ["cup"],
    officialUrl: "https://www.cup.edu.cn/overseas/Admission/Scholarships/index.htm",
    deadline: { month: 5, day: 30 },
    englishLang: { ielts: "6.5", toefl: "80", altProof: true },
    note: "Beijing Government Foreign Students Scholarship and Chinese Government Scholarship at China University of Petroleum (Beijing). English-taught Master's/PhD: IELTS 6.5, TOEFL 80, or a letter confirming at least two years of English-medium study; Chinese-taught: HSK 4 (222, Bachelor's) or HSK 5 (180, Master's/PhD). Deadlines 15 May (undergraduate) and 30 May (postgraduate); age limits 25/35/40. Source: cup.edu.cn/overseas.",
  },
  {
    match: ["cug"],
    officialUrl: "https://eniec.cug.edu.cn/Scholarships/CUG_President_Scholarship.htm",
    englishLang: { ielts: "6.0", toefl: "80", altProof: true },
    note: "CUG President Scholarship: on-campus accommodation fully waived (double room CNY 8,400/year for undergraduate/master's; single room CNY 12,000/year for PhD); tuition and living costs self-funded. English-taught: IELTS 6.0, TOEFL iBT 80 or proof of English-medium instruction; Chinese-taught: HSK 4 (180+). Priority to geosciences and natural-resource disciplines. Source: eniec.cug.edu.cn.",
  },
  {
    match: ["shnu"],
    officialUrl: "https://iccs.shnu.edu.cn/en/29462/list.htm",
    note: "SHNU scholarships: Chinese Government Scholarship (full or partial — tuition, accommodation, comprehensive insurance, living allowance), Shanghai Government Scholarship (Class A full / Class B partial), International Chinese Language Teachers Scholarship and university scholarships. Source: iccs.shnu.edu.cn.",
  },
  {
    match: ["dgut"],
    officialUrl: "https://gjxy.dgut.edu.cn/index/Home.htm",
    note: "DGUT Tuition Scholarship for new international students and the Guangdong Provincial Government Scholarship. Source: gjxy.dgut.edu.cn.",
  },
  {
    match: ["sias"],
    officialUrl: "https://en.sias.edu.cn/info/1053/4990.htm",
    note: "SIAS University scholarships include full tuition (with accommodation and meals for programs delivered with Fort Hays State University, USA); university scholarship applications run through the residential colleges. Source: en.sias.edu.cn.",
  },
  {
    match: ["usst"],
    officialUrl: "https://en.usst.edu.cn/Study_with_us/Scholarship.htm",
    note: "Shanghai Government Scholarship Type A (full: tuition, accommodation, comprehensive medical insurance, monthly allowance) and Type B (partial: tuition and insurance) at USST; Chinese Government Scholarship also available. Age limits 25 (Bachelor's), 35 (Master's), 40 (PhD). Source: en.usst.edu.cn.",
  },
  {
    match: ["dufe"],
    officialUrl: "https://sie.dufe.edu.cn/en/hta/ss/",
    englishLang: { ielts: "6.5", altProof: true },
    note: "DUFE scholarships: Outstanding Students Scholarship CNY 3,000–6,000/year; freshmen English-medium scholarship CNY 3,500 (IELTS 6.5 with minimum 6.0 per section, or native English); foundation-program scholarship CNY 5,000 (HSK 4 at 220+); alumni 10% tuition waiver; Chinese Government Scholarship. Source: sie.dufe.edu.cn.",
  },
  {
    match: ["wzu"],
    officialUrl: "https://cic.wzu.edu.cn/info/1022/1266.htm",
    deadline: { month: 5, day: 10 },
    note: "Wenzhou University Scholarship A: 1st prize 70%, 2nd 40%, 3rd 20% of annual tuition for bachelor's/master's applicants (apply before 10 May); Scholarship B and C for current students; Chinese Government Scholarship (stipend CNY 2,500/3,000/3,500 per month by level). Source: cic.wzu.edu.cn.",
  },
  {
    match: ["syuct"],
    officialUrl: "https://www.syuct.edu.cn/gjjy/info/1099/1091.htm",
    note: "SYUCT offers scholarships and subsidies for international students: Chinese language scholarships and partial tuition waivers for degree students (up to CNY 3,000–4,000 of tuition). Source: syuct.edu.cn/gjjy.",
  },
  {
    match: ["ujs"],
    officialUrl: "https://oec.ujs.edu.cn/en/SCHOLARSHIPS.htm",
    note: "JSU Presidential Scholarship: PhD Type A (tuition + accommodation + one-time CNY 5,000 stipend), Type B (tuition + accommodation); Master's Type A CNY 25,000; Jasmine (Jiangsu Provincial Government) Scholarship and Chinese Government Scholarship also available. Source: oec.ujs.edu.cn.",
  },
  {
    match: ["xisu"],
    officialUrl: "https://six.xisu.edu.cn/lxxwywz/Scholarships/Xi_an_International_Studies_University_Scholarship/Xi_an_International_Studies_University_Scholarship.htm",
    note: "XISU scholarships: Chinese Government Scholarship, International Chinese Language Teachers Scholarship, Shaanxi Provincial Government Scholarship, Xi'an Municipal Government (Belt and Road) Scholarship and the XISU University Scholarship. Source: six.xisu.edu.cn.",
  },
  {
    match: ["seu"],
    officialUrl: "https://cis.seu.edu.cn/hwenglish/14010/list.htm",
    note: "SEU scholarships: Chinese Government Scholarship (CSC), SEU CSC-sponsored Postgraduate Program, Jiangsu Provincial Government (Jasmine) Scholarship, Nanjing Municipal Government Scholarship, SEU President Scholarship and the International Chinese Language Teachers Scholarship. Source: cis.seu.edu.cn.",
  },
  {
    match: ["cpu"],
    officialUrl: "https://international.cpu.edu.cn/362/list.htm",
    englishLang: { ielts: "6.5", toefl: "90" },
    note: "CPU scholarships include the President Scholarship and Chinese Government Scholarship. English-taught programs: IELTS 6.5 or TOEFL iBT 90; Chinese-taught: HSK 4+. Age: at least 18, under 35 (Master's) and under 45 (PhD). Source: international.cpu.edu.cn.",
  },
  {
    match: ["tju"],
    officialUrl: "https://sie.tju.edu.cn/en/jxj/tjszfjxj/",
    deadline: { month: 5, day: 31 },
    durations: { undergraduate: "4–5 years", masters: "2–3 years" },
    note: "Tianjin Government Scholarship: Master's First Prize CNY 30,000 tuition + CNY 1,700/month allowance (10 months), Bachelor's First Prize CNY 20,000 + CNY 1,400/month; Second Prize covers tuition only; one-year duration, renewable; application window mid-October to 31 May. TJU International Student Scholarship also available. Source: sie.tju.edu.cn.",
  },
  {
    match: ["nhmu"],
    officialUrl: "http://www.nxmu.edu.cn/ywz/",
    note: "Ningxia Medical University offers international-student scholarships, including a freshman scholarship of CNY 15,000 for top entrance-exam performers and an Excellent Student Scholarship (CNY 15,000) for the top 5% of students annually. English-medium MBBS programme. Source: nxmu.edu.cn/ywz.",
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

      const langRaw = r.languageRequirements as string;
      const hasLang = langRaw && langRaw !== "[]" && langRaw !== "{}";
      if (!hasLang) {
        if (eng && pol.englishLang) {
          data.languageRequirements = JSON.stringify({
            ielts: true, toefl: pol.englishLang.toefl ? true : false, noIelts: false,
            altProof: pol.englishLang.altProof ?? false,
            notRequired: false,
          });
          lang++;
        } else if (!eng) {
          data.languageRequirements = JSON.stringify({
            ielts: false, toefl: false, noIelts: true, altProof: false, notRequired: true,
          });
          lang++;
        }
      }

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

      if (pol.deadline && !r.deadline) {
        data.deadline = nextOccurrence(pol.deadline.month, pol.deadline.day);
        data.deadlineTimezone = "CST (China Standard Time)";
        dl++;
      }

      if (pol.officialUrl && r.officialUrl !== pol.officialUrl) {
        data.officialUrl = pol.officialUrl;
        url++;
      }

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
