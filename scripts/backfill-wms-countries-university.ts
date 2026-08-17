/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// Backfill destination countries for wemakescholars.com records.
//
// Strategy (in priority order):
//   1. University-page map  — data/wms-university-countries.json, built by
//      scripts/backfill-wms-university-countries.py. Each provider was mapped
//      to a country via the <h1>..<h4> country signal on
//      /university/{slug}/scholarships (authoritative).
//   2. Provider-name hints — explicit country/city names embedded in the
//      provider string (e.g. "Murdoch University (MU) Australia" -> AU).
//      Only applied when the record has no country yet.
//
// The map also CORRECTS nationality-based misassignments from the earlier
// text backfill (e.g. "Duke Law India Masters" -> IN was wrong; Duke is US).
//
// Usage:
//   npm run backfill:wms-countries -- --dry-run
// ---------------------------------------------------------------------------

import { prisma } from "../src/lib/prisma";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

const MAP_FILE = path.join(process.cwd(), "data", "wms-university-countries.json");

// --------------------------------------------------------------------------
// Explicit country names -> can OVERRIDE an existing (possibly nationality-
// based) assignment, e.g. "Murdoch University (MU) Australia" must be AU even
// if a previous text backfill guessed otherwise.
// --------------------------------------------------------------------------
const EXPLICIT_HINTS: Array<[RegExp, string]> = [
  [/Australia/, "AU"], [/Canada/, "CA"], [/England/, "GB"], [/Scotland/, "GB"],
  [/Northern Ireland/, "GB"], [/Ireland/, "IE"], [/United States/, "US"],
  [/USA/, "US"], [/America/, "US"], [/Germany/, "DE"], [/France/, "FR"],
  [/Spain/, "ES"], [/Italy/, "IT"], [/Netherlands/, "NL"], [/Sweden/, "SE"],
  [/Norway/, "NO"], [/Denmark/, "DK"], [/Finland/, "FI"], [/Switzerland/, "CH"],
  [/Belgium/, "BE"], [/Austria/, "AT"], [/Japan/, "JP"], [/China/, "CN"],
  [/Korea/, "KR"], [/Singapore/, "SG"], [/Malaysia/, "MY"], [/Dubai/, "AE"],
  [/UAE/, "AE"], [/Qatar/, "QA"], [/Saudi Arabia/, "SA"], [/Turkey/, "TR"],
  [/New Zealand/, "NZ"], [/Hong Kong/, "HK"], [/Hongkong/, "HK"],
];

// --------------------------------------------------------------------------
// City / institution-level hints -> only fill when the record has NO country
// (city names like "London" or "Hamilton" are ambiguous across countries).
// --------------------------------------------------------------------------
const COUNTRY_HINTS: Array<[RegExp, string]> = [
  // UK cities / schools
  [/London/, "GB"], [/Belfast/, "GB"], [/Egham/, "GB"], [/Solent/, "GB"],
  [/Bristol/, "GB"], [/Southampton/, "GB"], [/Abertay/, "GB"], [/Dundee/, "GB"],
  [/Middlesex/, "GB"], [/Bayes/, "GB"], [/Kings College London/, "GB"],
  [/Queen Mary/, "GB"], [/Royal Holloway/, "GB"], [/Cranfield/, "GB"],
  [/Warwick/, "GB"], [/Reading/, "GB"], [/Surrey/, "GB"], [/Sussex/, "GB"],
  [/Essex/, "GB"], [/Keele/, "GB"], [/Hull/, "GB"], [/Kent/, "GB"],
  [/Lancaster/, "GB"], [/Leicester/, "GB"], [/Liverpool/, "GB"],
  [/Manchester/, "GB"], [/Nottingham/, "GB"], [/Oxford/, "GB"], [/Exeter/, "GB"],
  [/York/, "GB"], [/Bath/, "GB"], [/Birmingham/, "GB"], [/Bradford/, "GB"],
  [/Brighton/, "GB"], [/Brunel/, "GB"], [/Cardiff/, "GB"], [/Glasgow/, "GB"],
  [/Aberdeen/, "GB"], [/Edinburgh/, "GB"], [/Leeds/, "GB"], [/Sheffield/, "GB"],
  [/Loughborough/, "GB"], [/UWE/, "GB"], [/West of England/, "GB"],
  // Ireland
  [/Dublin/, "IE"], [/Galway/, "IE"], [/Cork/, "IE"], [/Limerick/, "IE"],
  [/Maynooth/, "IE"], [/National University of Ireland/, "IE"],
  // Germany
  [/Berlin/, "DE"], [/Munich/, "DE"], [/Hamburg/, "DE"], [/Leipzig/, "DE"],
  [/Dresden/, "DE"], [/Cologne/, "DE"], [/Frankfurt/, "DE"], [/Hannover/, "DE"],
  [/Aachen/, "DE"], [/Bremen/, "DE"], [/Bonn/, "DE"], [/Freiburg/, "DE"],
  [/Heidelberg/, "DE"], [/Tübingen/, "DE"], [/Tuebingen/, "DE"],
  [/Stuttgart/, "DE"], [/Nuremberg/, "DE"], [/Erlangen/, "DE"], [/Bochum/, "DE"],
  [/Dortmund/, "DE"], [/Duisburg/, "DE"], [/Kiel/, "DE"], [/Mainz/, "DE"],
  [/Mannheim/, "DE"], [/Potsdam/, "DE"], [/Wuppertal/, "DE"], [/Kassel/, "DE"],
  [/Göttingen/, "DE"], [/Goettingen/, "DE"], [/Saarbrücken/, "DE"],
  [/Bamberg/, "DE"], [/Bayreuth/, "DE"], [/Jena/, "DE"], [/Konstanz/, "DE"],
  [/Ulm/, "DE"], [/Weimar/, "DE"], [/Osnabrück/, "DE"], [/Braunschweig/, "DE"],
  [/Rostock/, "DE"], [/Greifswald/, "DE"], [/Passau/, "DE"], [/Regensburg/, "DE"],
  [/Trier/, "DE"], [/Siegen/, "DE"], [/Darmstadt/, "DE"], [/Karlsruhe/, "DE"],
  [/Hohenheim/, "DE"], [/Hertie/, "DE"], [/SRH/, "DE"], [/DAAD/, "DE"],
  [/German Academic/, "DE"],
  // France
  [/Paris/, "FR"], [/Lyon/, "FR"], [/Marseille/, "FR"], [/Toulouse/, "FR"],
  [/Bordeaux/, "FR"], [/Lille/, "FR"], [/Strasbourg/, "FR"], [/Nantes/, "FR"],
  [/Grenoble/, "FR"], [/Nice/, "FR"], [/Rennes/, "FR"], [/Montpellier/, "FR"],
  // Netherlands
  [/Amsterdam/, "NL"], [/Rotterdam/, "NL"], [/Utrecht/, "NL"], [/Delft/, "NL"],
  [/Eindhoven/, "NL"], [/Groningen/, "NL"], [/Leiden/, "NL"], [/Maastricht/, "NL"],
  [/Wageningen/, "NL"], [/Twente/, "NL"],
  // Nordics
  [/Stockholm/, "SE"], [/Gothenburg/, "SE"], [/Uppsala/, "SE"], [/Lund/, "SE"],
  [/Copenhagen/, "DK"], [/Aarhus/, "DK"], [/Aalborg/, "DK"], [/Oslo/, "NO"],
  [/Bergen/, "NO"], [/Trondheim/, "NO"], [/Helsinki/, "FI"], [/Turku/, "FI"],
  [/Oulu/, "FI"],
  // Switzerland
  [/Zurich/, "CH"], [/Zürich/, "CH"], [/Geneva/, "CH"], [/Lausanne/, "CH"],
  [/Basel/, "CH"], [/Bern/, "CH"], [/Fribourg/, "CH"], [/Lucerne/, "CH"],
  // Belgium / Austria
  [/Brussels/, "BE"], [/Leuven/, "BE"], [/Antwerp/, "BE"], [/Ghent/, "BE"],
  [/Vienna/, "AT"], [/Graz/, "AT"], [/Innsbruck/, "AT"], [/Salzburg/, "AT"],
  // Southern Europe
  [/Madrid/, "ES"], [/Barcelona/, "ES"], [/Valencia/, "ES"], [/Seville/, "ES"],
  [/Milan/, "IT"], [/Rome/, "IT"], [/Turin/, "IT"], [/Bologna/, "IT"],
  [/Florence/, "IT"], [/Naples/, "IT"], [/Pisa/, "IT"], [/Padua/, "IT"],
  // Asia / Pacific
  [/Tokyo/, "JP"], [/Kyoto/, "JP"], [/Osaka/, "JP"], [/Nagoya/, "JP"],
  [/Beijing/, "CN"], [/Shanghai/, "CN"], [/Seoul/, "KR"], [/Kyung Hee/, "KR"],
  [/Kuala Lumpur/, "MY"], [/Auckland/, "NZ"], [/Wellington/, "NZ"],
  [/Melbourne/, "AU"], [/Sydney/, "AU"], [/Perth/, "AU"], [/Brisbane/, "AU"],
  [/Adelaide/, "AU"], [/Canberra/, "AU"], [/Hobart/, "AU"], [/Newcastle/, "AU"],
  [/Wollongong/, "AU"], [/Bundoora/, "AU"], [/Bunbury/, "AU"], [/Murdoch/, "AU"],
  [/Curtin/, "AU"], [/Edith Cowan/, "AU"], [/La Trobe/, "AU"], [/UniSA/, "AU"],
  [/South Australia/, "AU"],
  // Canada
  [/Toronto/, "CA"], [/Montreal/, "CA"], [/Vancouver/, "CA"], [/Ottawa/, "CA"],
  [/Calgary/, "CA"], [/Edmonton/, "CA"], [/Winnipeg/, "CA"], [/Halifax/, "CA"],
  [/Quebec/, "CA"], [/Waterloo/, "CA"], [/Hamilton/, "CA"], [/Guelph/, "CA"],
  [/Kingston/, "CA"], [/Saskatoon/, "CA"], [/Regina/, "CA"], [/Victoria/, "CA"],
  [/Kelowna/, "CA"], [/Sudbury/, "CA"], [/Thunder Bay/, "CA"], [/Fredericton/, "CA"],
  [/Moncton/, "CA"], [/Sackville/, "CA"], [/Conestoga/, "CA"], [/Algoma/, "CA"],
  [/Red River/, "CA"],
  // USA
  [/New York/, "US"], [/Boston/, "US"], [/Chicago/, "US"], [/Los Angeles/, "US"],
  [/San Francisco/, "US"], [/Houston/, "US"], [/Philadelphia/, "US"],
  [/Phoenix/, "US"], [/Seattle/, "US"], [/Miami/, "US"], [/Atlanta/, "US"],
  [/Dallas/, "US"], [/Austin/, "US"], [/Denver/, "US"], [/Detroit/, "US"],
  [/Pittsburgh/, "US"], [/Portland/, "US"], [/San Diego/, "US"],
  [/Minneapolis/, "US"], [/St\. Louis/, "US"], [/Baltimore/, "US"],
  [/Cleveland/, "US"], [/Tampa/, "US"], [/Orlando/, "US"], [/Cincinnati/, "US"],
  [/Kansas City/, "US"], [/Columbus/, "US"], [/Indianapolis/, "US"],
  [/Milwaukee/, "US"], [/Nashville/, "US"], [/New Orleans/, "US"],
  [/Memphis/, "US"], [/Louisville/, "US"], [/Charlotte/, "US"], [/Raleigh/, "US"],
  [/Richmond/, "US"], [/Buffalo/, "US"], [/Rochester/, "US"], [/Albany/, "US"],
  [/Syracuse/, "US"], [/Ithaca/, "US"], [/New Haven/, "US"], [/Princeton/, "US"],
  [/Stanford/, "US"], [/Durham/, "US"], [/Ann Arbor/, "US"], [/Madison/, "US"],
  [/Boulder/, "US"], [/Eugene/, "US"], [/Tucson/, "US"], [/Albuquerque/, "US"],
  [/Salt Lake City/, "US"], [/Las Vegas/, "US"], [/Frisco/, "US"], [/Denton/, "US"],
  [/Fort Wayne/, "US"], [/Indiana/, "US"], [/Troy/, "US"], [/Mississippi/, "US"],
  [/North Texas/, "US"], [/San Francisco State/, "US"], [/Pittsburg State/, "US"],
  [/Illinois Institute/, "US"], [/Washington State/, "US"],
  [/SUNY/, "US"], [/State University of New York/, "US"],
  // US states / cities without pages on wemakescholars
  [/Kansas/, "US"], [/Maine/, "US"], [/Florida/, "US"], [/Arkansas/, "US"],
  [/Colorado/, "US"], [/Wichita/, "US"], [/St\. Bonaventure/, "US"],
  [/Grand Valley/, "US"], [/California Student Aid/, "US"],
  [/California State/, "US"], [/Musicians Institute/, "US"],
  [/Forte Foundation/, "US"], [/International Center for Journalists/, "US"],
  [/Experimental Aircraft/, "US"],
  // Korea
  [/Sogang/, "KR"], [/Gwangju/, "KR"], [/Ulsan/, "KR"],
  // Sweden / Germany / Turkey / Czechia
  [/Skovde/, "SE"], [/Chemnitz/, "DE"], [/ESMT/, "DE"],
  [/Food Security Center/, "DE"], [/Antalya/, "TR"], [/South Moravian/, "CZ"],
  // UK
  [/Plymouth/, "GB"], [/Bournemouth/, "GB"], [/Gloucestershire/, "GB"],
  [/University for the Creative Arts/, "GB"], [/EPSRC/, "GB"],
  [/Allan & Nesta Ferguson/, "GB"],
  // verified via officialUrl
  [/Laidlaw/, "NZ"], [/Humber/, "CA"], [/St Lawrence College/, "CA"],
  [/Schulich/, "CA"], [/SEARCA/, "PH"], [/International Peoples College/, "DK"],
  [/MEXT/, "JP"], [/Meridian Vocational/, "AU"],
  // verified via officialUrl (second pass)
  [/St Paul's School/, "AU"], [/Canadian Institutes of Health/, "CA"],
  [/Remus/, "AT"], [/Freemason Foundation/, "AU"], [/Knowledge Media Institute/, "GB"],
  [/SME.? Education Foundation/, "US"], [/National Security Education Board/, "US"],
  [/Commonwealth Scholarship Commission/, "GB"], [/CSIRO/, "AU"],
  [/SPJIMR/, "IN"], [/W&RSETA/, "ZA"], [/BUITEMS/, "PK"],
  [/State University of Malang/, "ID"], [/Ministry of Science and Technology/, "IN"],
  [/Invensis/, "IN"], [/Mayo Foundation/, "US"], [/Bowling Green State/, "US"],
  [/Academy of Interactive/, "AU"], [/Georg Eckert/, "DE"], [/Åbo Akademi/, "FI"],
  [/Southern New Hampshire/, "US"], [/Pony Chung/, "KR"], [/EMLV/, "FR"],
  [/South East European University/, "MK"], [/GISMA/, "DE"], [/SolBridge/, "KR"],
  [/Dalarna/, "SE"], [/Kathmandu College/, "NP"], [/CEMEF/, "FR"],
  [/Staffordshire/, "GB"], [/Inha University/, "KR"], [/IMT/, "IN"],
  [/Saint Vincent de Paul/, "GB"], [/Siberian Federal/, "RU"], [/NABA/, "IT"],
  [/Brigham Young/, "US"], [/UNIDROIT/, "IT"], [/Tax Policy Charitable/, "NZ"],
  [/Nuova Accademia/, "IT"],
  [/Online News Association/, "US"], [/St Margaret's College/, "NZ"],
  [/European University Institute/, "IT"], [/UICC/, "CH"], [/IMechE/, "GB"],
  [/Fulbright Commission/, "PL"], [/Baden-Württemberg/, "DE"],
  [/Sultan Qaboos/, "US"], [/Royal Northern College/, "GB"],
  [/Pennsylvania State/, "US"], [/Sault College/, "CA"], [/FWO/, "BE"],
  [/Chuck Lorre/, "US"], [/Wharton/, "US"], [/Kochi University of Technology/, "JP"],
  [/LUT University/, "FI"], [/Lappeenranta/, "FI"], [/ICTP/, "IT"],
  [/Institute for Basic Science/, "KR"], [/U\.S\. Department of Health/, "US"],
  [/Kwok Scholars/, "GB"], [/Chatham House/, "GB"],
];

function hintFor(provider: string, list: Array<[RegExp, string]>): string | null {
  for (const [re, iso] of list) {
    if (re.test(provider)) return iso;
  }
  return null;
}

async function main() {
  const uniMap: Record<string, { provider: string; iso: string | null }> = JSON.parse(
    fs.readFileSync(MAP_FILE, "utf-8")
  );

  const wms = await prisma.scholarship.findMany({
    where: { sourceUrl: { contains: "wemakescholars.com" } },
    select: { id: true, provider: true, countryCode: true, sourceUrl: true },
  });
  console.log(`wms records in DB: ${wms.length}`);

  const updates: Array<{ id: string; code: string; why: string }> = [];
  for (const r of wms) {
    const mapped = uniMap[r.provider]?.iso;
    if (mapped) {
      // university page is authoritative — overrides any prior assignment
      if (mapped !== r.countryCode) {
        updates.push({ id: r.id, code: mapped, why: "map" });
      }
      continue;
    }
    const explicit = hintFor(r.provider, EXPLICIT_HINTS);
    if (explicit) {
      if (explicit !== r.countryCode) {
        updates.push({ id: r.id, code: explicit, why: "explicit" });
      }
      continue;
    }
    if (r.countryCode) continue; // only fill records still missing a country
    const hint = hintFor(r.provider, COUNTRY_HINTS);
    if (hint) updates.push({ id: r.id, code: hint, why: "hint" });
  }

  // verify country codes exist
  const codes = [...new Set(updates.map((u) => u.code))];
  const countries = await prisma.country.findMany({ where: { code: { in: codes } }, select: { code: true } });
  const valid = new Set(countries.map((c) => c.code));
  const missingCodes = codes.filter((c) => !valid.has(c));
  if (missingCodes.length) console.log("WARN: unknown country codes:", missingCodes);
  const usable = updates.filter((u) => valid.has(u.code));

  const byWhy = new Map<string, number>();
  for (const u of usable) byWhy.set(u.why, (byWhy.get(u.why) ?? 0) + 1);
  console.log("updates:", usable.length, "| by source:", Object.fromEntries(byWhy));

  if (DRY_RUN) {
    console.log("DRY RUN — no changes written");
    await prisma.$disconnect();
    return;
  }

  // batch in chunks of 500
  for (let i = 0; i < usable.length; i += 500) {
    const chunk = usable.slice(i, i + 500);
    await prisma.$transaction(
      chunk.map((u) =>
        prisma.scholarship.update({ where: { id: u.id }, data: { countryCode: u.code } })
      )
    );
  }
  console.log(`updated ${usable.length} records`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
