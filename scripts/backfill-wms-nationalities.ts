// ---------------------------------------------------------------------------
// Fill eligibleNationalities for wemakescholars records from the crawled
// "Eligible Nationalities" spec (data/wms-nationalities.jsonl).
//
// The spec text follows patterns like:
//   "Open to all nationals"                     -> ["ALL"]
//   "Open to Indian nationals / Indian citizens" -> ["IN"]
//   "Open to Australian and New Zealand nationals" -> ["AU", "NZ"]
//   "Open for International students"           -> ["ALL"]
//   Regional restrictions (e.g. "Southeastern Manitoba", "non-South Carolina
//   residents") cannot be expressed as country codes — those stay unset.
//
// Only records that currently have empty eligibleNationalities are touched.
// "ALL" means open to every nationality (the app's convention).
//
// Usage:
//   npm run backfill:wms-nationalities -- --dry-run
//   npm run backfill:wms-nationalities
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

// nationality adjective / country name -> ISO code
const COUNTRY_WORDS: [string, string][] = [
  ["indian", "IN"], ["india", "IN"],
  ["american", "US"], ["united states", "US"], ["u.s", "US"], ["us citizens", "US"], ["usa", "US"],
  ["canadian", "CA"], ["canada", "CA"],
  ["australian", "AU"], ["australia", "AU"],
  ["new zealander", "NZ"], ["new zealand", "NZ"],
  ["british", "GB"], ["united kingdom", "GB"], ["uk ", "GB"], ["england", "GB"], ["scottish", "GB"],
  ["irish", "IE"], ["ireland", "IE"],
  ["german", "DE"], ["germany", "DE"],
  ["french", "FR"], ["france", "FR"],
  ["italian", "IT"], ["italy", "IT"],
  ["spanish", "ES"], ["spain", "ES"],
  ["dutch", "NL"], ["netherlands", "NL"], ["holland", "NL"],
  ["belgian", "BE"], ["belgium", "BE"],
  ["swedish", "SE"], ["sweden", "SE"],
  ["norwegian", "NO"], ["norway", "NO"],
  ["danish", "DK"], ["denmark", "DK"],
  ["finnish", "FI"], ["finland", "FI"],
  ["swiss", "CH"], ["switzerland", "CH"],
  ["austrian", "AT"], ["austria", "AT"],
  ["portuguese", "PT"], ["portugal", "PT"],
  ["polish", "PL"], ["poland", "PL"],
  ["czech", "CZ"], ["czechia", "CZ"], ["czech republic", "CZ"],
  ["hungarian", "HU"], ["hungary", "HU"],
  ["greek", "GR"], ["greece", "GR"],
  ["turkish", "TR"], ["turkey", "TR"],
  ["japanese", "JP"], ["japan", "JP"],
  ["korean", "KR"], ["south korea", "KR"],
  ["chinese", "CN"], ["china", "CN"],
  ["singaporean", "SG"], ["singapore", "SG"],
  ["malaysian", "MY"], ["malaysia", "MY"],
  ["indonesian", "ID"], ["indonesia", "ID"],
  ["thai", "TH"], ["thailand", "TH"],
  ["vietnamese", "VN"], ["vietnam", "VN"],
  ["filipino", "PH"], ["philippines", "PH"],
  ["pakistani", "PK"], ["pakistan", "PK"],
  ["bangladeshi", "BD"], ["bangladesh", "BD"],
  ["sri lankan", "LK"], ["sri lanka", "LK"],
  ["nepalese", "NP"], ["nepal", "NP"],
  ["afghan", "AF"], ["afghanistan", "AF"],
  ["iranian", "IR"], ["iran", "IR"],
  ["iraqi", "IQ"], ["iraq", "IQ"],
  ["israeli", "IL"], ["israel", "IL"],
  ["saudi", "SA"], ["saudi arabia", "SA"],
  ["emirati", "AE"], ["uae", "AE"], ["united arab emirates", "AE"],
  ["qatari", "QA"], ["qatar", "QA"],
  ["kuwaiti", "KW"], ["kuwait", "KW"],
  ["omani", "OM"], ["oman", "OM"],
  ["jordanian", "JO"], ["jordan", "JO"],
  ["lebanese", "LB"], ["lebanon", "LB"],
  ["egyptian", "EG"], ["egypt", "EG"],
  ["nigerian", "NG"], ["nigeria", "NG"],
  ["ghanaian", "GH"], ["ghana", "GH"],
  ["kenyan", "KE"], ["kenya", "KE"],
  ["ethiopian", "ET"], ["ethiopia", "ET"],
  ["tanzanian", "TZ"], ["tanzania", "TZ"],
  ["ugandan", "UG"], ["uganda", "UG"],
  ["south african", "ZA"], ["south africa", "ZA"],
  ["moroccan", "MA"], ["morocco", "MA"],
  ["tunisian", "TN"], ["tunisia", "TN"],
  ["algerian", "DZ"], ["algeria", "DZ"],
  ["mexican", "MX"], ["mexico", "MX"],
  ["brazilian", "BR"], ["brazil", "BR"],
  ["argentine", "AR"], ["argentina", "AR"],
  ["chilean", "CL"], ["chile", "CL"],
  ["colombian", "CO"], ["colombia", "CO"],
  ["peruvian", "PE"], ["peru", "PE"],
  ["venezuelan", "VE"], ["venezuela", "VE"],
  ["russian", "RU"], ["russia", "RU"],
  ["ukrainian", "UA"], ["ukraine", "UA"],
  ["kazakh", "KZ"], ["kazakhstan", "KZ"],
  ["hong kong", "HK"], ["hongkong", "HK"],
  ["taiwanese", "TW"], ["taiwan", "TW"],
  ["mongolian", "MN"], ["mongolia", "MN"],
  ["myanmar", "MM"], ["burmese", "MM"],
  ["cambodian", "KH"], ["cambodia", "KH"],
  ["laotian", "LA"], ["laos", "LA"],
  ["bruneian", "BN"], ["brunei", "BN"],
  ["croatian", "HR"], ["croatia", "HR"],
  ["serbian", "RS"], ["serbia", "RS"],
  ["slovenian", "SI"], ["slovenia", "SI"],
  ["slovak", "SK"], ["slovakia", "SK"],
  ["romanian", "RO"], ["romania", "RO"],
  ["bulgarian", "BG"], ["bulgaria", "BG"],
  ["albanian", "AL"], ["albania", "AL"],
  ["bosnian", "BA"], ["bosnia", "BA"],
  ["macedonian", "MK"], ["north macedonia", "MK"],
  ["georgian", "GE"], ["georgia", "GE"],
  ["armenian", "AM"], ["armenia", "AM"],
  ["azerbaijani", "AZ"], ["azerbaijan", "AZ"],
  ["cuban", "CU"], ["cuba", "CU"],
  ["jamaican", "JM"], ["jamaica", "JM"],
  ["trinidad", "TT"], ["trinidadian", "TT"],
  ["barbadian", "BB"], ["barbados", "BB"],
  ["bahamian", "BS"], ["bahamas", "BS"],
];

// sort by length desc so "south african" matches before "african"
COUNTRY_WORDS.sort((a, b) => b[0].length - a[0].length);

function parseNationality(text: string): string[] | null {
  const lower = ` ${text.toLowerCase()} `;

  // Exclusion phrases can't be expressed as an inclusion list ("non-Chinese"
  // means open to EVERYONE except CN). Leave those unset rather than wrong.
  if (/\bnon[- ]/i.test(text) || /\bexcept\b|\bexcluding\b|\bexcluded\b/i.test(text)) {
    return null;
  }

  // open to all / any / international
  if (
    /all nationals|all nationalities|any nationality|any national|international students|internationals|open to all|worldwide|all over the world/i.test(lower)
  ) {
    return ["ALL"];
  }

  // Bare "US nationals" / "UK nationals" ("us"/"uk" are also common words,
  // so require a nationality hint nearby).
  const isNatContext = /nationals?|citizens?|residents?/i.test(lower);
  if (isNatContext) {
    if (/\b(us|u\.?s\.?|usa)\b/i.test(lower)) return ["US"];
    if (/\buk\b/i.test(lower)) return ["GB"];
  }

  // "Only for X" or "Open to X" — extract the country words
  const found = new Set<string>();
  for (const [word, code] of COUNTRY_WORDS) {
    if (new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower)) {
      found.add(code);
    }
  }
  if (found.size === 0) return null; // regional or unparseable — leave unset
  return [...found];
}

async function main() {
  // Load crawled nationalities.
  const rows: { slug: string; nationality: string | null }[] = [];
  try {
    const raw = readFileSync("data/wms-nationalities.jsonl", "utf-8");
    for (const line of raw.split("\n").filter(Boolean)) {
      const r = JSON.parse(line) as { slug: string; nationality?: string | null };
      rows.push({ slug: r.slug, nationality: r.nationality ?? null });
    }
  } catch {
    console.error("Could not read data/wms-nationalities.jsonl — aborting.");
    process.exit(1);
  }
  console.log(`Crawled nationalities: ${rows.length}`);

  // Build slug -> codes.
  const bySlug = new Map<string, string[]>();
  let parseable = 0;
  for (const r of rows) {
    if (!r.nationality || r.nationality.startsWith("ERR")) continue;
    const codes = parseNationality(r.nationality);
    if (codes) {
      bySlug.set(r.slug, codes);
      parseable++;
    }
  }
  console.log(`Parseable: ${parseable} (unparseable/regional left unset)`);

  // Find wms records with empty eligibleNationalities whose sourceUrl slug matches.
  const records = await prisma.scholarship.findMany({
    where: {
      sourceUrl: { contains: "wemakescholars" },
      eligibleNationalities: "[]",
    },
    select: { id: true, sourceUrl: true },
  });
  console.log(`wms records with empty eligibleNationalities: ${records.length}`);

  const updates: { id: string; codes: string[] }[] = [];
  let all = 0;
  let restricted = 0;
  for (const rec of records) {
    if (!rec.sourceUrl) continue;
    const slug = rec.sourceUrl.split("/").pop();
    if (!slug) continue;
    const codes = bySlug.get(slug);
    if (!codes) continue;
    if (codes.includes("ALL")) all++;
    else restricted++;
    updates.push({ id: rec.id, codes });
  }

  console.log(`Records to update: ${updates.length} (ALL: ${all}, restricted: ${restricted})`);

  if (DRY_RUN) {
    for (const u of updates.slice(0, 10)) console.log(`  [dry-run] ${u.id} -> ${JSON.stringify(u.codes)}`);
    return;
  }

  let applied = 0;
  const BATCH = 250;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((u) =>
        prisma.scholarship.update({
          where: { id: u.id },
          data: { eligibleNationalities: JSON.stringify(u.codes), updatedAt: new Date() },
        }),
      ),
    );
    applied += batch.length;
    console.log(`Applied ${applied}/${updates.length}...`);
  }
  console.log(`Done: updated ${applied} records.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
