// Create University records for the 73 universities in the user's
// faculty_data_all.xlsx (All Universities sheet) that we don't have yet, and
// link every unlinked scholarship whose title names one of them.
//
// Matching is by distinctive name fragment on scholarship titles; aliases
// (HUST -> Huazhong University of Science and Technology) are handled
// explicitly, and lookalikes that are DIFFERENT institutions
// (Xi'an Jiaotong-Liverpool != Xi'an Jiaotong University) are excluded.
//
// Usage: npx tsx scripts/link-xlsx-universities.ts [--dry-run]
import { prisma } from "../src/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

// (slug-friendly name, display name, distinctive title fragments to match)
interface UniDef {
  slug: string;
  name: string;
  match: string[]; // lowercase fragments; ALL must be absent from a title to link
  exclude?: string[]; // titles containing any of these are skipped
}

const UNIS: UniDef[] = [
  { slug: "tongji-university", name: "Tongji University", match: ["tongji university"] },
  { slug: "central-south-university", name: "Central South University", match: ["central south university"] },
  { slug: "fudan-university", name: "Fudan University", match: ["fudan university"] },
  { slug: "harbin-medical-university", name: "Harbin Medical University", match: ["harbin medical"] },
  { slug: "southern-medical-university", name: "Southern Medical University", match: ["southern medical university"] },
  { slug: "sun-yat-sen-university", name: "Sun Yat-sen University", match: ["sun yat-sen", "sun yat sen", "sun yatsen"] },
  { slug: "tsinghua-university", name: "Tsinghua University", match: ["tsinghua"] },
  { slug: "anhui-medical-university", name: "Anhui Medical University", match: ["anhui medical"] },
  { slug: "zhejiang-university", name: "Zhejiang University", match: ["zhejiang university"], exclude: ["zhejiang university of", "zhejiang normal university", "zhejiang chinese medical university", "zhejiang a & f university", "zhejiang wanli university", "zhejiang gongshang university", "zhejiang ocean university", "zhejiang sci-tech university", "zhejiang shuren university", "zhejiang international studies university", "zhejiang jiaxing university"] },
  { slug: "jiangsu-university", name: "Jiangsu University", match: ["jiangsu university"], exclude: ["jiangsu university of", "jiangsu normal university", "jiangsu ocean university", "jiangsu second normal university", "jiangsu university of technology"] },
  { slug: "xuzhou-medical-university", name: "Xuzhou Medical University", match: ["xuzhou medical"] },
  { slug: "jilin-university", name: "Jilin University", match: ["jilin university"], exclude: ["jilin normal university", "jilin university of", "jilin agricultural university", "jilin international studies university", "jilin engineering normal university", "jilin jianzhu university", "jilin institute"] },
  { slug: "guangzhou-medical-university", name: "Guangzhou Medical University", match: ["guangzhou medical"] },
  { slug: "shantou-university", name: "Shantou University", match: ["shantou"] },
  { slug: "shanghai-jiao-tong-university", name: "Shanghai Jiao Tong University", match: ["shanghai jiao tong", "shanghai jiaotong"] },
  { slug: "china-medical-university", name: "China Medical University", match: ["china medical university"] },
  { slug: "shandong-university", name: "Shandong University", match: ["shandong university"], exclude: ["shandong university of", "shandong normal university", "shandong jianzhu university", "shandong polytechnic", "shandong water", "shandong agricultural university", "shandong jiaotong university", "shandong university of science and technology", "shandong university of traditional chinese medicine"] },
  { slug: "chongqing-medical-university", name: "Chongqing Medical University", match: ["chongqing medical"] },
  { slug: "dalian-medical-university", name: "Dalian Medical University", match: ["dalian medical"] },
  { slug: "peking-university", name: "Peking University", match: ["peking university", "beijing university"], exclude: ["beijing university of", "beijing normal university", "beijing foreign studies", "beijing language", "beijing jiaotong", "beijing institute", "beijing union university"] },
  { slug: "peking-union-medical-college", name: "Peking Union Medical College", match: ["peking union", "pumc", "cams", "chinese academy of medical sciences"] },
  { slug: "capital-medical-university", name: "Capital Medical University", match: ["capital medical"] },
  { slug: "tianjin-medical-university", name: "Tianjin Medical University", match: ["tianjin medical"] },
  { slug: "xinjiang-medical-university", name: "Xinjiang Medical University", match: ["xinjiang medical"] },
  { slug: "nanjing-medical-university", name: "Nanjing Medical University", match: ["nanjing medical"] },
  { slug: "wenzhou-medical-university", name: "Wenzhou Medical University", match: ["wenzhou medical"] },
  { slug: "wuhan-university", name: "Wuhan University", match: ["wuhan university"], exclude: ["wuhan university of", "wuhan polytechnic university", "wuhan institute of", "wuhan textile university", "wuhan business university", "wuhan university of science and technology", "wuhan university of technology"] },
  { slug: "huazhong-university-of-science-and-technology", name: "Huazhong University of Science and Technology", match: ["huazhong", "hust"], exclude: ["huston", "hustle", "huazhong agricultural", "huazhong normal"] },
  { slug: "xian-jiaotong-university", name: "Xi'an Jiaotong University", match: ["xian jiaotong", "xi'an jiaotong", "xi an jiaotong"], exclude: ["xian jiaotong-liverpool", "xi'an jiaotong-liverpool", "xjtlu"] },
  { slug: "jinan-university", name: "Jinan University", match: ["jinan university"], exclude: ["jinan university of"] },
  { slug: "guangxi-medical-university", name: "Guangxi Medical University", match: ["guangxi medical"] },
  { slug: "sichuan-university", name: "Sichuan University", match: ["sichuan university"], exclude: ["sichuan university of", "sichuan agricultural university", "sichuan normal university", "sichuan vocational", "sichuan international studies university", "sichuan university of science and engineering"] },
  { slug: "beihua-university", name: "Beihua University", match: ["beihua"] },
  { slug: "jinzhou-medical-university", name: "Jinzhou Medical University", match: ["jinzhou medical"] },
  { slug: "qingdao-university", name: "Qingdao University", match: ["qingdao university"], exclude: ["qingdao university of", "qingdao agricultural university", "qingdao binhai university", "qingdao university of science and technology", "qingdao university of technology"] },
  { slug: "hebei-medical-university", name: "Hebei Medical University", match: ["hebei medical"] },
  { slug: "ningxia-medical-university", name: "Ningxia Medical University", match: ["ningxia medical"] },
  { slug: "shihezi-university", name: "Shihezi University", match: ["shihezi"] },
  { slug: "southeast-university", name: "Southeast University", match: ["southeast university"], exclude: ["southeast university of", "southeastern", "southeast missouri", "nova southeastern"] },
  { slug: "yangzhou-university", name: "Yangzhou University", match: ["yangzhou university"] },
  { slug: "nantong-university", name: "Nantong University", match: ["nantong university"] },
  { slug: "soochow-university", name: "Soochow University", match: ["soochow"] },
  { slug: "ningbo-university", name: "Ningbo University", match: ["ningbo university"], exclude: ["ningbo university of", "ningbo nottingham", "ningbo institute"] },
  { slug: "fujian-medical-university", name: "Fujian Medical University", match: ["fujian medical"] },
  { slug: "china-three-gorges-university", name: "China Three Gorges University", match: ["three gorges"] },
  { slug: "zhengzhou-university", name: "Zhengzhou University", match: ["zhengzhou university"], exclude: ["zhengzhou university of", "zhengzhou normal university", "zhengzhou university of light industry", "zhengzhou university of aeronautics"] },
  { slug: "kunming-medical-university", name: "Kunming Medical University", match: ["kunming medical"] },
  { slug: "southwest-medical-university", name: "Southwest Medical University", match: ["southwest medical"] },
  { slug: "xiamen-university", name: "Xiamen University", match: ["xiamen university"], exclude: ["xiamen university of"] },
  { slug: "lanzhou-university", name: "Lanzhou University", match: ["lanzhou university"], exclude: ["lanzhou university of", "lanzhou jiaotong university", "lanzhou city university"] },
  { slug: "dali-university", name: "Dali University", match: ["dali university"] },
];

async function main() {
  // Existing universities + scholarships
  const existingUnis = await prisma.university.findMany({ select: { id: true, name: true, slug: true } });
  const bySlug = new Map(existingUnis.map((u) => [u.slug, u]));
  const byName = new Map(existingUnis.map((u) => [u.name.toLowerCase(), u]));

  const orphans = await prisma.scholarship.findMany({
    where: { recordType: "SCHOLARSHIP", universityId: null },
    select: { id: true, title: true, provider: true, status: true },
  });
  console.log(`orphaned scholarships: ${orphans.length}`);

  let created = 0;
  let linked = 0;
  const linkedTitles: Record<string, number> = {};

  for (const def of UNIS) {
    let uni = bySlug.get(def.slug) ?? byName.get(def.name.toLowerCase());
    const isNew = !uni;
    if (!uni) {
      if (!DRY_RUN) {
        const row = await prisma.university.create({
          data: {
            slug: def.slug,
            name: def.name,
            countryCode: "CN",
            logoText: def.name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(),
            color: ["#1D4ED8", "#0E7490", "#15803D", "#A16207", "#BE185D", "#6B21A8"][def.slug.length % 6],
          },
        });
        uni = row;
      } else {
        uni = { id: "new", name: def.name, slug: def.slug } as never;
      }
      created++;
    }

    let uniLinked = 0;
    for (const o of orphans) {
      const tl = o.title.toLowerCase();
      if (def.exclude?.some((x) => tl.includes(x))) continue;
      if (!def.match.some((m) => tl.includes(m))) continue;
      if (!DRY_RUN) {
        await prisma.scholarship.update({ where: { id: o.id }, data: { universityId: (uni as { id: string }).id } });
      }
      uniLinked++;
      linked++;
    }
    linkedTitles[def.name] = uniLinked;
    console.log(`  ${isNew ? (DRY_RUN ? "[NEW] " : "[created] ") : "      "}${def.name}: linked ${uniLinked}`);
  }

  console.log(`\ncreated: ${created}, linked: ${linked}`);
  if (!DRY_RUN) {
    const now = await prisma.university.count();
    console.log(`total university records now: ${now}`);
  }
}
main().finally(() => prisma.$disconnect());
