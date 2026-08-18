import { createManySkipDuplicates } from "./lib/insert-many";
/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// pathwaystoscience.org importer — US STEM research/fellowship opportunities.
//
// PathwaysToScience (Institute for Broadening Participation) maintains a
// curated database of ~1,050 fully funded US STEM research programs
// (REUs, fellowships, summer research, internships). Every program has:
//   - a title + description
//   - academic levels (high school / undergrad / grad / postdoc)
//   - academic disciplines
//   - host institution(s) with US locations
//   - an official "Learn More and Apply" URL
// (No per-program deadline dates are published — only an "upcoming
// deadline" flag, so deadline stays null rather than being invented.)
//
//   Phase 1 (listing): crawl the 26 alphabet pages (programs.aspx?alpha=X),
//                      collect programhub sort IDs + institution/location.
//                      Checkpoint -> data/pts-programs.json (resumable)
//   Phase 2 (details): fetch each programhub.aspx?sort=... page, parse
//                      structured fields. Checkpoint -> data/pts-details.jsonl
//   Phase 3 (insert):  bulk-insert as PENDING/UNVERIFIED, deduped by source
//                      URL, recordType SCHOLARSHIP.
//
// Usage:
//   npm run import:pts -- --listing-only    # Phase 1 only
//   npm run import:pts -- --detail-only     # Phase 2 only
//   npm run import:pts -- --insert-only     # Phase 3 from checkpoint
//   npm run import:pts -- --dry-run         # report only, no writes
// ---------------------------------------------------------------------------

import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/utils";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LISTING_ONLY = args.includes("--listing-only");
const DETAIL_ONLY = args.includes("--detail-only");
const INSERT_ONLY = args.includes("--insert-only");

const PROGRAMS_FILE = path.join(process.cwd(), "data", "pts-programs.json");
const DETAILS_FILE = path.join(process.cwd(), "data", "pts-details.jsonl");
const BASE = "https://www.pathwaystoscience.org";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const CONCURRENCY = 8;

// --- PTS academic level -> ScholarAtlas study level slugs -------------------
function mapLevels(raw: string): string[] {
  const s = raw.toLowerCase();
  const out: string[] = [];
  if (/high school/.test(s)) out.push("high-school");
  if (/undergraduates?/.test(s) || /community college/.test(s)) out.push("undergraduate");
  if (/graduate students \(masters\)|graduate students \(ma\)|masters/.test(s)) out.push("masters");
  if (/graduate students \(phd\)|graduate students \(ph\.d\)|doctoral/.test(s)) out.push("phd");
  if (/postdoc/.test(s)) out.push("postdoctoral");
  if (/research/.test(s) && out.length === 0) out.push("research");
  return out;
}

// --- PTS academic disciplines -> ScholarAtlas field slugs -------------------
const DISCIPLINE_FIELDS: Array<[RegExp, string]> = [
  [/computer science|computer engineering|informatics|computational/, "computer-science"],
  [/artificial intelligence|machine learning|deep learning|robotics/, "artificial-intelligence"],
  [/data science|big data|data analytics/, "data-science"],
  [/cyber/, "cybersecurity"],
  [/bioengineering|biomedical engineering|biomedical/, "biotechnology"],
  [/biotechnology/, "biotechnology"],
  [/aerospace|astronautic|mechanical|electrical|chemical engineering|civil engineering|environmental engineering|industrial engineering|materials science|materials engineering|nuclear engineering|ocean engineering|engineering/, "engineering"],
  [/medical|medicine|health sciences|pharmaceutical|pharmacolog|clinical/, "medicine"],
  [/public health|epidemiology|nutrition/, "public-health"],
  [/nursing/, "nursing"],
  [/biochem|molecular biology|cell biology|microbiology|genetics|genomics|biology|zoology|botany|plant sciences|physiology|neuroscience|marine biology/, "biology"],
  [/chemistry/, "chemistry"],
  [/physics|astronomy|astrophysics|optics|materials physics/, "physics"],
  [/mathematics|statistics/, "mathematics"],
  [/environmental|ecology|ocean|atmospheric|earth sciences|geoscience|geology|climate/, "environmental-science"],
  [/natural sciences|science, technology|stem|sciences/, "natural-sciences"],
  [/business|management|marketing|entrepreneurship|accounting/, "business"],
  [/finance|economics|econometrics/, "economics"],
  [/law|legal/, "law"],
  [/political science|public policy|government/, "political-science"],
  [/international relations|international affairs|global/, "international-relations"],
  [/social sciences|sociology|anthropology|geography|history/, "social-sciences"],
  [/psychology|behavioral/, "psychology"],
  [/education|teaching|teacher/, "education"],
  [/agricultur|food science|animal science/, "agriculture"],
  [/architecture|urban/, "architecture"],
  [/arts|humanities|literature|linguistics|philosophy/, "arts"],
  [/design/, "design"],
  [/communication|media|journalism/, "media"],
  [/music/, "music"],
];

function mapFields(disciplines: string[]): string[] {
  const out = new Set<string>();
  const joined = disciplines.join(" ").toLowerCase();
  for (const [re, slug] of DISCIPLINE_FIELDS) {
    if (re.test(joined)) out.add(slug);
  }
  return [...out];
}

// --- country from a "(City, ST)" location string ----------------------------
const NON_US: Array<[RegExp, string | null]> = [
  [/canada/i, "CA"], [/mexico/i, "MX"], [/united kingdom|uk\b|england|scotland/i, "GB"],
  [/germany/i, "DE"], [/france/i, "FR"], [/spain/i, "ES"], [/italy/i, "IT"],
  [/netherlands/i, "NL"], [/sweden/i, "SE"], [/norway/i, "NO"], [/denmark/i, "DK"],
  [/finland/i, "FI"], [/switzerland/i, "CH"], [/austria/i, "AT"], [/belgium/i, "BE"],
  [/japan/i, "JP"], [/china/i, "CN"], [/korea/i, "KR"], [/singapore/i, "SG"],
  [/australia/i, "AU"], [/new zealand/i, "NZ"], [/india/i, "IN"],
  [/international|abroad|global/i, null],
];

function countryFromLocation(loc: string): string | null {
  for (const [re, code] of NON_US) {
    if (re.test(loc)) return code; // null code = international/multi-country
  }
  return "US";
}

// --- Phase 1: listing -------------------------------------------------------
async function crawlListing() {
  const existing: { letters: Record<string, Array<{ sort: string; title: string; institution: string; location: string }>> } =
    fs.existsSync(PROGRAMS_FILE) ? JSON.parse(fs.readFileSync(PROGRAMS_FILE, "utf8")) : { letters: {} };

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let idx = 0; idx < letters.length; idx++) {
    const ch = letters[idx];
    if (existing.letters[ch]) {
      console.log(`  ${ch}: already crawled (${existing.letters[ch].length})`);
      continue;
    }
    const url = `${BASE}/programs.aspx?submit=y&alpha=${ch}&pos=${idx}`;
    let html = "";
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
      html = await res.text();
    } catch (e) {
      console.log(`  ${ch}: fetch failed — ${(e as Error).message.slice(0, 80)}`);
      continue;
    }
    // each program: <div class='progigert'>Institution <i>(City, ST)</i></div>
    //               <div ...><a href='programhub.aspx?sort=...'>Title</a>...<div>desc
    const programs: Array<{ sort: string; title: string; institution: string; location: string }> = [];
    const seen = new Set<string>();
    // blocks alternate: institution header (<h2>) -> program link (<a>) -> ...
    const blocks = html.split(/<div class='progigert'/);
    let pendingInst = { institution: "", location: "" };
    for (const block of blocks.slice(1)) {
      const instMatch = block.match(/<h2[^>]*>([^<]+)<\/h2><i><span[^>]*>\s*(?:\(([^)]*)\))?/);
      if (instMatch) {
        pendingInst = {
          institution: instMatch[1].replace(/\s*\(Lead\)\s*/i, "").trim(),
          location: instMatch[2] ? instMatch[2].trim() : "",
        };
      }
      const link = block.match(/<a href='programhub\.aspx\?sort=([^']+)'>([^<]*)<\/a>/);
      if (link && !seen.has(link[1])) {
        seen.add(link[1]);
        programs.push({ sort: link[1], title: link[2].trim(), ...pendingInst });
      }
    }
    existing.letters[ch] = programs;
    fs.writeFileSync(PROGRAMS_FILE, JSON.stringify(existing));
    console.log(`  ${ch}: ${programs.length} programs`);
    await new Promise((r) => setTimeout(r, 300));
  }
  const total = Object.values(existing.letters).reduce((s, a) => s + a.length, 0);
  console.log(`Listing complete: ${total} programs`);
  return existing;
}

// --- Phase 2: details -------------------------------------------------------
interface PtsRecord {
  sort: string;
  skip?: boolean;
  title: string;
  provider: string;
  description: string;
  officialUrl: string | null;
  sourceUrl: string;
  countryCode: string | null;
  levels: string[];
  fields: string[];
  fundingType: string;
  institution: string;
  location: string;
}

function parseDetail(html: string, meta: { sort: string; title: string; institution: string; location: string }): PtsRecord | null {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const title = (h1 ? h1[1] : meta.title).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!title) return null;

  const apply = html.match(/<a href='([^']+)'[^>]*>Click Here to Learn More and Apply!/);
  const officialUrl = apply ? apply[1] : null;

  const descMatch = html.match(/<b>Description:<\/b><br>\s*([\s\S]*?)<br><br><b>Participating/);
  const description = descMatch
    ? descMatch[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
    : "";

  // academic levels: plain text lines between "Academic Level:" and "Description:"
  // (the italic "upcoming status" note is optional)
  const lvMatch = html.match(/Academic Level:<\/b><br>(?:<i>[\s\S]*?<\/i><br><br>)?([\s\S]*?)<br><br><b>Description:/);
  const levelsRaw = lvMatch ? lvMatch[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ") : "";
  const levels = mapLevels(levelsRaw);

  // disciplines: items inside the <span style='font-size:8pt'> block, split on <br>
  const discMatch = html.match(/Academic Disciplines:<\/span> <\/b><span[^>]*><br>([\s\S]*?)<br><\/span>/);
  const disciplines = discMatch
    ? discMatch[1].split("<br>").map((l) => l.replace(/<[^>]+>/g, "").trim()).filter(Boolean)
    : [];

  const countryCode = countryFromLocation(meta.location);
  const fundingType = /fully funded/i.test(description) ? "FULLY_FUNDED" : "PARTIAL";

  return {
    sort: meta.sort,
    title,
    provider: meta.institution || "Not specified",
    description: description || `${title} — STEM research program listed on pathwaystoscience.org.`,
    officialUrl,
    sourceUrl: `${BASE}/programhub.aspx?sort=${encodeURIComponent(meta.sort)}`,
    countryCode,
    levels,
    fields: mapFields(disciplines),
    fundingType,
    institution: meta.institution,
    location: meta.location,
  };
}

async function crawlDetails(programs: Array<{ sort: string; title: string; institution: string; location: string }>) {
  const done = new Set<string>();
  const out = fs.createWriteStream(DETAILS_FILE, { flags: "a" });
  if (fs.existsSync(DETAILS_FILE)) {
    for (const line of fs.readFileSync(DETAILS_FILE, "utf8").split("\n").filter(Boolean)) {
      try {
        done.add((JSON.parse(line) as PtsRecord).sort);
      } catch {
        /* skip */
      }
    }
  }
  const pending = programs.filter((p) => !done.has(p.sort));
  console.log(`details: ${done.size} done, ${pending.length} to fetch`);

  let fetched = 0;
  const queue = [...pending];
  const worker = async () => {
    for (;;) {
      const p = queue.shift();
      if (!p) return;
      try {
        const res = await fetch(`${BASE}/programhub.aspx?sort=${encodeURIComponent(p.sort)}`, {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(30000),
        });
        const html = await res.text();
        const rec = parseDetail(html, p);
        if (rec) {
          done.add(p.sort);
          out.write(JSON.stringify(rec) + "\n");
        } else {
          done.add(p.sort);
          out.write(JSON.stringify({ ...p, sort: p.sort, skip: true }) + "\n");
        }
      } catch {
        done.add(p.sort);
        out.write(JSON.stringify({ ...p, sort: p.sort, skip: true }) + "\n");
      }
      fetched += 1;
      if (fetched % 50 === 0) console.log(`  fetched ${fetched}/${pending.length}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  out.end();
  console.log(`details complete`);
}

// --- Phase 3: insert --------------------------------------------------------
async function insertRecords() {
  const lines = fs.readFileSync(DETAILS_FILE, "utf8").split("\n").filter(Boolean);
  const records: PtsRecord[] = [];
  for (const line of lines) {
    try {
      const rec = JSON.parse(line) as PtsRecord;
      if (!rec.skip && rec.title) records.push(rec);
    } catch {
      /* skip */
    }
  }
  console.log(`parsed records: ${records.length}`);

  const existing = await prisma.scholarship.findMany({
    where: { sourceUrl: { contains: "pathwaystoscience.org" } },
    select: { sourceUrl: true },
  });
  const existingSet = new Set(existing.map((e) => e.sourceUrl as string));
  const toInsert = records.filter((r) => !existingSet.has(r.sourceUrl));
  console.log(`to insert: ${toInsert.length} (${records.length - toInsert.length} already in DB)`);

  if (DRY_RUN) {
    const byCountry = new Map<string, number>();
    for (const r of toInsert) byCountry.set(r.countryCode ?? "none", (byCountry.get(r.countryCode ?? "none") ?? 0) + 1);
    const byLevel = new Map<string, number>();
    for (const r of toInsert) for (const lv of r.levels) byLevel.set(lv, (byLevel.get(lv) ?? 0) + 1);
    console.log("by country:", [...byCountry.entries()].sort((a, b) => b[1] - a[1]));
    console.log("by level:", [...byLevel.entries()].sort((a, b) => b[1] - a[1]));
    return;
  }

  // slug collisions happen on generic titles (e.g. two schools both run a
  // "Summer Research Opportunities Program") — disambiguate with a sort hash.
  const existingSlugs = new Set(
    (await prisma.scholarship.findMany({ select: { slug: true } })).map((s) => s.slug)
  );
  const uniqueSlug = (title: string, sort: string) => {
    let slug = slugify(title);
    if (!slug) slug = `pts-${sort.slice(0, 20)}`;
    if (existingSlugs.has(slug)) {
      slug = `${slug}-${sort.replace(/[^a-z0-9]/gi, "").slice(-8).toLowerCase()}`;
    }
    existingSlugs.add(slug);
    return slug;
  };

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 400) {
    const chunk = toInsert.slice(i, i + 400);
    const chunkInserted = await createManySkipDuplicates(
      prisma.scholarship,
      chunk.map((r) => ({
        title: r.title,
        slug: uniqueSlug(r.title, r.sort),
        description: r.description,
        provider: r.provider,
        providerType: "ORGANIZATION",
        countryCode: r.countryCode,
        studyLevels: JSON.stringify(r.levels),
        fields: JSON.stringify(r.fields),
        fundingType: r.fundingType,
        officialUrl: r.officialUrl,
        sourceUrl: r.sourceUrl,
        status: "PENDING",
        verificationStatus: "UNVERIFIED",
        recordType: "SCHOLARSHIP",
        submittedNote: `Imported from pathwaystoscience.org on ${new Date().toISOString().slice(0, 10)}`,
      }))
    );
    inserted += chunkInserted;
    console.log(`  inserted chunk ${i / 400 + 1}: ${chunkInserted} (total ${inserted})`);
  }
  console.log(`Inserted: ${inserted}`);
}

async function main() {
  if (INSERT_ONLY) {
    await insertRecords();
    await prisma.$disconnect();
    return;
  }
  const listing = await crawlListing();
  if (LISTING_ONLY) {
    await prisma.$disconnect();
    return;
  }
  const programs = Object.values(listing.letters).flat();
  await crawlDetails(programs);
  if (DETAIL_ONLY) {
    await prisma.$disconnect();
    return;
  }
  await insertRecords();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
