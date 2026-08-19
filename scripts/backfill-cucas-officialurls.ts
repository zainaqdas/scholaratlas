// ---------------------------------------------------------------------------
// CUCAS officialUrl backfill.
//
// The 2019/2023 Kaggle snapshots listed programs CUCAS no longer carries, so
// those records can't get a CUCAS program URL. The honest fallback is the
// host university's OWN official website — every URL below was verified live
// (HTTP 200 + the page title matched the university, or DNS resolution for
// .edu.cn domains that block foreign IPs). We also fill University.website
// so the Universities explorer benefits.
//
// Only records that STILL lack officialUrl are touched. Records with a real
// CUCAS program URL (from enrich-cucas.ts) are never overwritten.
//
// Usage:
//   npm run backfill:cucas-urls                 # apply
//   npm run backfill:cucas-urls -- --dry-run    # report only
// ---------------------------------------------------------------------------

import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

// Provider name -> verified official university website.
// Verification: HTTP 200 + title match, or DNS-resolves for IP-blocked .edu.cn.
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

async function main() {
  // Only Kaggle-sourced CUCAS records that still lack an officialUrl.
  const records = await prisma.scholarship.findMany({
    where: {
      sourceUrl: { contains: "kaggle" },
      officialUrl: null,
    },
    select: { id: true, provider: true, universityId: true },
  });
  console.log(`Records without officialUrl: ${records.length}`);

  // Group by provider and also collect the university rows to update.
  const byProvider = new Map<string, string[]>();
  for (const r of records) {
    const list = byProvider.get(r.provider) ?? [];
    list.push(r.id);
    byProvider.set(r.provider, list);
  }

  const universityIds = new Map<string, string[]>();
  const updates: { id: string; url: string }[] = [];
  const unmatchedProviders = new Set<string>();
  let urlCount = 0;

  for (const [provider, ids] of byProvider) {
    const url = UNIVERSITY_WEBSITES[provider];
    if (!url) {
      unmatchedProviders.add(provider);
      continue;
    }
    for (const id of ids) {
      updates.push({ id, url });
      urlCount += 1;
    }
    // Collect university rows for this provider so we can fill website too.
    const uniRows = records.filter((r) => r.provider === provider && r.universityId);
    const ids2 = universityIds.get(provider) ?? [];
    for (const u of uniRows) {
      if (u.universityId && !ids2.includes(u.universityId)) ids2.push(u.universityId);
    }
    universityIds.set(provider, ids2);
  }

  console.log(`Will set officialUrl on ${urlCount} records across ${byProvider.size - unmatchedProviders.size} providers.`);
  if (unmatchedProviders.size) {
    console.log(`Providers with NO verified website (left as-is): ${[...unmatchedProviders].join(", ")}`);
  }

  if (DRY_RUN) {
    console.log(`[dry-run] University.website updates: ${[...universityIds.values()].reduce((a, b) => a + b.length, 0)}`);
    console.log(`[dry-run] Example: ${updates[0]?.id} -> ${updates[0]?.url}`);
    return;
  }

  // Update University.website for the host universities.
  let uniUpdated = 0;
  for (const [provider, ids2] of universityIds) {
    const url = UNIVERSITY_WEBSITES[provider];
    if (!url) continue;
    for (const uid of ids2) {
      await prisma.university.update({
        where: { id: uid },
        data: { website: url, updatedAt: new Date() },
      });
      uniUpdated += 1;
    }
  }
  console.log(`University.website updated: ${uniUpdated}`);

  // Update scholarship officialUrl.
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
    console.log(`Applied ${applied}/${urlCount}...`);
  }
  console.log(`Done: officialUrl set on ${applied} records.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
