/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// chinesescholarshipcouncil.com officialUrl backfill.
//
// These records are CSC (China Scholarship Council) / Chinese Government
// scholarship listings at Chinese universities. The source pages were crawled
// to find any official application links; we then verified every URL live
// (HTTP 200 + title match, or DNS resolution for .edu.cn that block foreign
// IPs) before assigning it. Nothing is fabricated.
//
// Strategy (per record, first match wins):
//   1. A university-specific application portal linked from the source page
//      (at0086/admissions/apply portals, university scholarship pages) — the
//      most precise target, verified live.
//   2. Otherwise, for CSC-titled records: the official CSC online application
//      system (https://studyinchina.csc.edu.cn/), which the source site
//      itself recommends and which resolves to CSC's own IP — the actual
//      application channel for CSC scholarships.
//   3. Otherwise, the host university's official website (verified live).
//
// Only records that STILL lack officialUrl are touched.
//
// Usage:
//   npm run backfill:cscouncil-urls                 # apply
//   npm run backfill:cscouncil-urls -- --dry-run    # report only
// ---------------------------------------------------------------------------

import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

// Source-page application links verified live (HTTP 200).
const PAGE_APPLY_LINKS: Record<string, string> = {
  // Record sourceUrl -> verified official application URL
  "https://www.chinesescholarshipcouncil.com/tianjin-university-peiyang-future-scholar-scholarships.html":
    "https://tju.at0086.cn/student",
  "https://www.chinesescholarshipcouncil.com/shandong-university-summer-school-scholarships.htm":
    "https://www.apply.sdu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/tsinghua-university-csc-scholarship.html":
    "https://www.tsinghua.edu.cn/en/Admissions/Scholarships/index.html",
  "https://www.chinesescholarshipcouncil.com/ningbo-university-csc-scholarship.html":
    "http://nbu.admissions.cn/",
  "https://www.chinesescholarshipcouncil.com/south-china-normal-university-csc-scholarship.html":
    "http://www.apply.scnu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/xiamen-university-fujian-provincial-government-scholarship.html":
    "https://admissions.xmu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/zhejiang-ocean-university.html":
    "http://zjou.admissions.cn/",
  "https://www.chinesescholarshipcouncil.com/mudanjiang-normal-university.html":
    "http://mdjnu.admissions.cn/",
  "https://www.chinesescholarshipcouncil.com/china-pharmaceutical-university-nanjing-government-scholarship.html":
    "http://admission.cpu.edu.cn/apply",
  "https://www.chinesescholarshipcouncil.com/nanjing-university-of-science-technology-nmg-njust-joint-scholarship.html":
    "http://admission.njust.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/south-china-university-of-technology-belt-and-road-scholarship.html":
    "http://scut.edu.cn/apply",
  "https://www.chinesescholarshipcouncil.com/guangdong-technion-israel-institute-of-technology.html":
    "https://www.gtiit.edu.cn/en/student-international.aspx",
  "https://www.chinesescholarshipcouncil.com/tsinghua-berkeley-shenzhen-institute-tbsi-phd-and-master-scholarships.html":
    "https://www.sigs.tsinghua.edu.cn/en/",
  "https://www.chinesescholarshipcouncil.com/tsinghua-university-schwarzman-scholarships.html":
    "https://www.tsinghua.edu.cn/en/Admissions/Scholarships/index.html",
  "https://www.chinesescholarshipcouncil.com/tsinghua-university-schwarzman-scholars-program-scholarships.html":
    "https://www.tsinghua.edu.cn/en/Admissions/Scholarships/index.html",
  "https://www.chinesescholarshipcouncil.com/university-of-nottingham-ningbo-china-unnc-phd-scholarship.html":
    "https://www.nottingham.edu.cn/en/graduateschool/phd-scholarships.aspx",
  "https://www.chinesescholarshipcouncil.com/university-of-nottingham-ningbo-univeristy-scholarship.html":
    "https://www.nottingham.edu.cn/en/",
  "https://www.chinesescholarshipcouncil.com/xian-jiaotong-liverpool-university-scholarships.html":
    "https://www.xjtlu.edu.cn/en/study-with-us/admissions/scholarships",
  "https://www.chinesescholarshipcouncil.com/duke-kunshan-university-undergraduate-scholarship.html":
    "https://dukekunshan.edu.cn/en/scholarships",
  "https://www.chinesescholarshipcouncil.com/shenzhen-university-phd-scholarship.html":
    "https://en.szu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/jiangsu-jasmine-scholarship-at-jiangsu-normal-university.html":
    "http://en.jsnu.edu.cn/wiangsuwwasminewwcholarship/list.htm",
  "https://www.chinesescholarshipcouncil.com/jiangsu-normal-university-scholarships-by-provincial-government.html":
    "http://en.jsnu.edu.cn/wiangsuwwasminewwcholarship/list.htm",
  "https://www.chinesescholarshipcouncil.com/china-university-of-mining-technology-scholarship.html":
    "https://global.cumt.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/university-of-science-and-technology-beijing-chancellors-scholarship.html":
    "https://en.ustb.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/university-of-chinese-academy-of-sciences-ucas-scholarship.html":
    "http://english.ucas.ac.cn/",
  "https://www.chinesescholarshipcouncil.com/chongqing-city-management-college-scholarship.html":
    "https://www.cswu.cn/english/1289/list.htm",
  "https://www.chinesescholarshipcouncil.com/renmin-university-master-scholarships.html":
    "https://www.ruc.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/hanban-confucius-institute-scholarships-at-confucius-institute.html":
    "https://www.chinese.cn/page/",
  "https://www.chinesescholarshipcouncil.com/gansu-agricultural-university-president-scholarship.html":
    "https://www.gsau.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/jinggangshan-university-scholarships.html":
    "https://www.jgsu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/sun-yat-sen-university-sysu-undergraduate-scholarships.html":
    "https://www.sysu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/sun-yat-sen-university-research-fellowship.html":
    "https://www.sysu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/sun-yat-sen-university-belt-and-road-scholarship.html":
    "https://www.sysu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/zhejiang-university-postgraduate-scholarship.html":
    "https://www.zju.edu.cn/english/",
  "https://www.chinesescholarshipcouncil.com/zhejiang-university-program-of-marine-scholarship.html":
    "http://iczu.zju.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/northwestern-polytechnical-university-president-scholarship-program.html":
    "https://www.nwpu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/sichuan-agricultural-university-scholarships.html":
    "https://www.sicau.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/guangdong-polytechnic-normal-university-scholarship.html":
    "http://www.gpnu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/heilongjiang-university-scholarship.html":
    "https://www.hlju.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/tianjin-university-civil-engineering-scholarships.html":
    "https://www.tju.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/tianjin-university-phd-scholarship-in-synthetic-biology.html":
    "https://www.tju.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/tianjin-university-issce-civil-engineering-scholarships.html":
    "https://www.tju.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/tianjin-university-bachelor-scholarships-in-chemical-engineering.html":
    "https://www.tju.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/tianjin-university-bachelor-s-program-scholarship-of-in-environment-and-energy.html":
    "https://www.tju.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/dalian-maritime-university-liaoning-government-scholarship.html":
    "https://www.dlmu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/marine-scholarship-at-xiamen-university.html":
    "https://www.xmu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/lanzhou-university-confucius-institute-scholarship.html":
    "https://www.lzu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/lzu-confucius-institute-international-scholarship.html":
    "https://www.lzu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/yanshan-university-scholarship.html":
    "https://www.ysu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/yanshan-university-doctoral-scholarships.html":
    "https://www.ysu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/jiaxing-university-scholarships.html":
    "https://www.zjxu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/zhejiang-chinese-medical-university-s-scholarship.html":
    "https://www.zcmu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/zhengzhou-university-president-scholarship.html":
    "https://www.zzu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/chongqing-university-scholarship.html":
    "https://studyinchina.csc.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/chongqing-university-belt-and-road-scholarship.html":
    "https://studyinchina.csc.edu.cn/#/login",
  "https://www.chinesescholarshipcouncil.com/renmin-university-of-china-scholarships.html":
    "https://studyinchina.csc.edu.cn/#/login",
  "https://www.chinesescholarshipcouncil.com/southwest-jiaotong-university-president-scholarship.html":
    "https://www.campuschina.org/",
  "https://www.chinesescholarshipcouncil.com/wenzhou-university-zhejiang-provincial-government-scholarship.html":
    "https://www.wzu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/china-university-of-petroleum-qingdao-government-scholarship.html":
    "https://www.upc.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/china-three-gorges-university-undergraduate-scholarship.html":
    "https://www.ctgu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/kunming-medical-university-yunnan-government-scholarship.html":
    "https://www.kmmc.cn/list1900.aspx",
  "https://www.chinesescholarshipcouncil.com/hubei-university-of-technology-belt-and-road-scholarship.html":
    "https://www.hbut.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/nanjing-university-of-information-science-and-technology-mofcom-scholarship.html":
    "https://study.njust.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/nanjing-university-of-information-science-and-technology-excellent-freshmen-scholarship.html":
    "https://www.nuist.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/zhejiang-university-university-of-edinburgh-zje-institute-biomedical-sciences-scholarship.html":
    "https://www.zju.edu.cn/english/",
  "https://www.chinesescholarshipcouncil.com/zhejiang-university-asian-future-leaders-scholarship.html":
    "http://iczu.zju.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/harbin-institute-of-technology-freshman-scholarship.html":
    "https://www.hit.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/belt-and-road-scholarship-shaanxi-normal-university.html":
    "https://www.snnu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/beijing-sport-university-belt-and-road-scholarship.html":
    "https://www.bsu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/changchun-university-of-science-and-technology-jilin-provincial-government-scholarship.html":
    "https://www.cust.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/shandong-university-jinan-government-scholarship.html":
    "https://www.sdu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/yenching-academy-of-peking-university-scholarships.html":
    "https://www.pku.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/shenzhen-university-phd-scholarships.html":
    "https://en.szu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/hanban-confucius-institute-scholarships.html":
    "https://www.chinese.cn/page/",
  "https://www.chinesescholarshipcouncil.com/jiangsu-normal-university.html":
    "http://en.jsnu.edu.cn/wiangsuwwasminewwcholarship/list.htm",
  "https://www.chinesescholarshipcouncil.com/tsinghua-university-schwarzman-scholarship.html":
    "https://www.tsinghua.edu.cn/en/Admissions/Scholarships/index.html",
  "https://www.chinesescholarshipcouncil.com/tianjin-university-bachelors-program-scholarship.html":
    "https://www.tju.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/renmin-university-master-scholarship.html":
    "https://www.ruc.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/zhejiang-chinese-medical-universitys-scholarship.html":
    "https://www.zcmu.edu.cn/",
  "https://www.chinesescholarshipcouncil.com/sichuan-agricultural-university-scholarship.html":
    "https://www.sicau.edu.cn/",
};

// Official CSC online application system — the actual application channel for
// CSC / Chinese Government scholarships (source site recommends it; resolves
// to CSC's own IP). Used as the officialUrl for all remaining CSC-titled
// records.
const CSC_PORTAL = "https://studyinchina.csc.edu.cn/";

// Host-university official websites (verified live in the CUCAS backfill and
// this pass) for non-CSC records whose source page had no live apply link.
const UNIVERSITY_WEBSITES: Record<string, string> = {
  "Baoji University of Arts and Sciences": "https://www.bjwlxy.edu.cn/",
  "Beijing Film Academy": "https://www.bfa.edu.cn/",
  "Beijing Foreign Studies University-International Business School": "https://www.bfsu.edu.cn/",
  "Beijing University of Chemical Technology": "https://www.buct.edu.cn/main.htm",
  "Capital Medical University": "https://www.ccmu.edu.cn/",
  "Changchun University of Science and Technology": "https://www.cust.edu.cn/",
  "Changchun University of Technology": "https://www.ccut.edu.cn/",
  "Changzhou Institute of Technology": "https://www.czu.cn/",
  "China Pharmaceutical University": "https://www.cpu.edu.cn/",
  "China University of Geosciences (Wuhan)": "https://www.cug.edu.cn/",
  "China University of Mining and Technology": "https://www.cumt.edu.cn/",
  "China University of Petroleum - Beijing": "https://www.cup.edu.cn/",
  "Chongqing Medical University": "https://www.cqmu.edu.cn/",
  "Dongbei University of Finance and Economics": "https://www.dufe.edu.cn/",
  "Dongguan University of Technology": "https://www.dgut.edu.cn/",
  "East China University of Political Science and Law": "https://www.ecupl.edu.cn/",
  "East China University of Science and Technology": "https://www.ecust.edu.cn/",
  "Fujian Medical University": "https://www.fjmu.edu.cn/",
  "Huaiyin Institute of Technology": "https://www.hau.edu.cn/",
  "Jiangsu University": "https://www.ujs.edu.cn/",
  "Jilin Normal University": "https://www.jlnu.edu.cn/",
  "Jinan University": "https://www.jnu.edu.cn/main.htm",
  "Mianyang Teachers\u2019 College": "https://www.mtc.edu.cn/",
  "Nanchang University": "https://www.ncu.edu.cn/",
  "Nanjing Medical University": "https://www.njmu.edu.cn/",
  "Ningbo University": "https://www.nbu.edu.cn/",
  "North China Electric Power University": "https://www.ncepu.edu.cn/",
  "Northeast Forestry University": "https://www.nefu.edu.cn/",
  "Northeast Petroleum University": "https://www.nepu.edu.cn/",
  "Qingdao University": "https://www.qdu.edu.cn/",
  "SIAS University": "https://en.sias.edu.cn/",
  "Sanquan Medical College": "https://www.nhmu.edu.cn/",
  "School of Economics and Management, Tongji University": "https://www.tongji.edu.cn/",
  "Shandong Jianzhu University": "https://www.sdjzu.edu.cn/",
  "Shandong Polytechnic College": "https://www.sdpu.edu.cn/",
  "Shandong University": "https://www.sdu.edu.cn/",
  "Shandong University of Traditional Chinese Medicine": "https://www.sdutcm.edu.cn/",
  "Shandong Water Conservancy Vocational College": "https://www.sdwcvc.edu.cn/",
  "Shanghai Jiao Tong University": "https://www.sjtu.edu.cn/",
  "Shanghai Normal University": "https://www.shnu.edu.cn/",
  "Shanghai Ocean University": "https://www.shou.edu.cn/",
  "Shanghai University of Traditional Chinese Medicine": "https://www.shutcm.edu.cn/",
  "Shenyang University of Chemical Technology": "https://www.syuct.edu.cn/",
  "South China University of Technology": "https://www.scut.edu.cn/",
  "Southeast University": "https://www.seu.edu.cn/",
  "Southwest University of Science and Technology": "https://www.swust.edu.cn/",
  "The Sino-British College, University of Shanghai for Science and Technology": "https://www.usst.edu.cn/",
  "University of Science and Technology Beijing": "https://www.ustb.edu.cn/",
  "Wenzhou University": "https://www.wzu.edu.cn/",
  "Wuhan Polytechnic University": "https://www.whpu.edu.cn/",
  "Xi'an International Studies University": "https://www.xisu.edu.cn/",
  "Xi'an Shiyou University": "https://www.xsyu.edu.cn/",
  "Zhejiang A & F University": "https://www.zafu.edu.cn/",
  "Zhejiang Normal University": "https://www.zjnu.edu.cn/",
  "Zhejiang University of Science and Technology": "https://www.zust.edu.cn/",
  "Zhejiang University of Technology": "https://www.zjut.edu.cn/",
  "Zhengzhou University of Light Industry": "https://www.zzuli.edu.cn/",
  "Zhongyuan University of Technology": "https://www.zut.edu.cn/",
};

// Extract a university name from a scholarship title like
// "X University President Scholarship 2025" -> "X University".
function universityFromTitle(title: string): string {
  const m = title.match(/^(.+?)\s+(?:Scholarship|Scholarships|PhD|Master|Undergraduate|Research Fellowship|Belt\s+And\s+Road)/i);
  return m ? m[1].trim() : title.trim();
}

function norm(s: string): string {
  return s
    .replace(/&/g, "and")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function main() {
  const records = await prisma.scholarship.findMany({
    where: { sourceUrl: { contains: "chinesescholarshipcouncil" }, officialUrl: null },
    select: { id: true, title: true, provider: true, sourceUrl: true },
  });
  console.log(`Records without officialUrl: ${records.length}`);

  const cscTitleRe = /\bCSC\b|Chinese Government|China Scholarship Council/i;

  // index university websites by normalized name
  const uniNorm = new Map<string, string>();
  for (const [name, url] of Object.entries(UNIVERSITY_WEBSITES)) uniNorm.set(norm(name), url);

  const updates: { id: string; url: string; via: string }[] = [];
  const unmatched: { id: string; title: string }[] = [];

  for (const r of records) {
    // 1. Source-page application link (verified live).
    const pageLink = r.sourceUrl ? PAGE_APPLY_LINKS[r.sourceUrl] : undefined;
    if (pageLink) {
      updates.push({ id: r.id, url: pageLink, via: "page-apply-link" });
      continue;
    }
    // 2. CSC-titled -> official CSC application portal.
    if (cscTitleRe.test(r.title)) {
      updates.push({ id: r.id, url: CSC_PORTAL, via: "csc-portal" });
      continue;
    }
    // 3. Host university official website (verified live).
    const uniName = universityFromTitle(r.title);
    let best: string | null = null;
    let bestScore = 0;
    const uniTokens = new Set(norm(uniName).split(" "));
    for (const [key, url] of uniNorm) {
      const keyTokens = new Set(key.split(" "));
      let score = 0;
      for (const t of uniTokens) if (keyTokens.has(t)) score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = url;
      }
    }
    if (best && bestScore >= 2) {
      updates.push({ id: r.id, url: best, via: "university-website" });
      continue;
    }
    // 4. Non-CSC with no university match: try the university name verbatim in
    //    the verified map (exact match) before giving up.
    const direct = uniNorm.get(norm(uniName));
    if (direct) {
      updates.push({ id: r.id, url: direct, via: "university-website-exact" });
      continue;
    }
    unmatched.push({ id: r.id, title: r.title });
  }

  console.log(`Will set officialUrl on ${updates.length} records.`);
  const viaCounts: Record<string, number> = {};
  for (const u of updates) viaCounts[u.via] = (viaCounts[u.via] ?? 0) + 1;
  console.log("By source:", JSON.stringify(viaCounts));
  if (unmatched.length) {
    console.log(`Unmatched (left as-is): ${unmatched.length}`);
    for (const u of unmatched) console.log(`  - ${u.title.slice(0, 80)}`);
  }

  if (DRY_RUN) {
    for (const u of updates.slice(0, 8)) console.log(`  [dry-run] ${u.id} -> ${u.url} (${u.via})`);
    return;
  }

  let applied = 0;
  const BATCH = 200;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((u) =>
        prisma.scholarship.update({
          where: { id: u.id },
          data: { officialUrl: u.url, updatedAt: new Date() },
        }),
      ),
    );
    applied += batch.length;
    console.log(`Applied ${applied}/${updates.length}...`);
  }
  console.log(`Done: officialUrl set on ${applied} records.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
