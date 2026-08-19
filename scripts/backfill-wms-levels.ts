// ---------------------------------------------------------------------------
// Backfill study levels for wemakescholars records that currently show
// "Not specified".
//
// The original mapLevels() missed several "eligible degrees" values the site
// uses: "Post Doc" (space), "High/Secondary School", "Diploma",
// "Medicine (MBBS/ MD)", "Other". This script:
//
//   1. Finds every wms record with an empty studyLevels array.
//   2. Re-fetches each detail page (resumable checkpoint JSONL, concurrency 8).
//   3. Extracts levels from the "eligible degrees" field with an improved
//      matcher, falling back to the title (e.g. "Post-Doctoral Fellowship…").
//   4. Writes back to the DB (only when something confident was found).
//
// Values we deliberately do NOT map (ambiguous, would be fabrication):
//   - "Medicine (MBBS/ MD)"  (professional degree, not undergrad/master/phd)
//   - "Other" / "Conferences & Travel Grants"
//
// "Diploma" IS mapped -> undergraduate (college/polytechnic diplomas are
// post-secondary undergraduate credentials) except "Higher Diploma" and
// "Executive Diploma" (graduate/professional-level).
//
// Usage:
//   npm run backfill:wms-levels -- --dry-run
// ---------------------------------------------------------------------------

import { prisma } from "../src/lib/prisma";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

const CHECKPOINT = path.join(process.cwd(), "data", "wms-levels-backfill.jsonl");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const CONCURRENCY = 8;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Improved level matcher for the "eligible degrees" field (+ title guard). */
function mapDegrees(raw: string, title = ""): string[] {
  const s = raw.toLowerCase();
  const guard = (raw + " " + title).toLowerCase(); // "Higher Diploma" often only appears in the title
  const out: string[] = [];
  if (/high school|highschool|secondary/.test(s)) out.push("high-school");
  if (/bachelor|undergraduate|associate/.test(s)) out.push("undergraduate");
  if (/diploma/.test(s) && !/higher diploma|executive diploma/.test(guard)) out.push("undergraduate");
  if (/master|graduate|postgraduate/.test(s)) out.push("masters");
  if (/\bmba\b/.test(s)) out.push("mba");
  if (/ph\.?d|doctoral|doctorate/.test(s)) out.push("phd");
  if (/post\s?doc|postdoctoral/.test(s)) out.push("postdoctoral");
  if (/\bresearch\b/.test(s)) out.push("research");
  if (/short[-\s]?course/.test(s)) out.push("short-course");
  if (/exchange/.test(s)) out.push("exchange-program");
  return out;
}

/** Title fallback — only fires when the degrees field gave nothing. */
function mapTitle(title: string): string[] {
  const s = title.toLowerCase();
  const out: string[] = [];
  if (/post\s?doc|postdoctoral/.test(s)) out.push("postdoctoral");
  if (/ph\.?d|doctoral|doctorate/.test(s)) out.push("phd");
  if (/\bmba\b/.test(s)) out.push("mba");
  if (/undergraduate|bachelor/.test(s)) out.push("undergraduate");
  if (/master|postgraduate|graduate/.test(s)) out.push("masters");
  if (/high school|secondary school|school students/.test(s)) out.push("high-school");
  if (/exchange/.test(s)) out.push("exchange-program");
  if (/short[-\s]?course/.test(s)) out.push("short-course");
  if (/research|fellowship/.test(s) && out.length === 0) out.push("research");
  return out;
}

function extractLevels(html: string, title: string): string[] {
  const m = html.match(
    /Eligible Degrees:\s*<\/p>\s*<span class="text-line-value">\s*([\s\S]*?)<\/span>/
  );
  const deg = m
    ? m[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
    : "";
  const levels = mapDegrees(deg, title);
  if (levels.length) return levels;
  return mapTitle(title);
}

async function main() {
  const wms = await prisma.scholarship.findMany({
    where: { sourceUrl: { contains: "wemakescholars.com" } },
    select: { id: true, sourceUrl: true, title: true, studyLevels: true },
  });
  const empty = wms.filter((r) => {
    try {
      return (JSON.parse(r.studyLevels) as string[]).length === 0;
    } catch {
      return true;
    }
  });
  console.log(`wms records: ${wms.length} | empty studyLevels: ${empty.length}`);

  // resume from checkpoint
  const done = new Map<string, string[]>();
  if (fs.existsSync(CHECKPOINT)) {
    for (const line of fs.readFileSync(CHECKPOINT, "utf8").split("\n").filter(Boolean)) {
      try {
        const rec = JSON.parse(line) as { url: string; levels: string[] };
        done.set(rec.url, rec.levels);
      } catch {
        /* skip malformed */
      }
    }
  }
  const pending = empty.filter((r) => r.sourceUrl && (!done.has(r.sourceUrl) || done.get(r.sourceUrl)!.length === 0));
  console.log(`checkpointed: ${done.size} | to fetch: ${pending.length}`);

  if (DRY_RUN) {
    console.log("DRY RUN — no network or DB writes");
    await prisma.$disconnect();
    return;
  }

  // fetch remaining pages
  const out = fs.createWriteStream(CHECKPOINT, { flags: "a" });
  let fetched = 0;
  const queue = [...pending];
  const worker = async () => {
    for (;;) {
      const rec = queue.shift();
      if (!rec) return;
      try {
        const html = await fetchText(rec.sourceUrl!);
        const title = (html.match(/<h1[^>]*>([^<]+)<\/h1>/) ?? [])[1]?.trim() || rec.title;
        const levels = extractLevels(html, title);
        done.set(rec.sourceUrl!, levels);
        out.write(JSON.stringify({ url: rec.sourceUrl, levels }) + "\n");
      } catch {
        done.set(rec.sourceUrl!, []);
        out.write(JSON.stringify({ url: rec.sourceUrl, levels: [] }) + "\n");
      }
      fetched += 1;
      if (fetched % 50 === 0) console.log(`  fetched ${fetched}/${pending.length}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  out.end();
  console.log(`fetch complete: ${done.size} pages parsed`);

  // update DB
  let updated = 0;
  let stillEmpty = 0;
  const byLevel: Record<string, number> = {};
  for (const r of empty) {
    const levels = r.sourceUrl ? done.get(r.sourceUrl) : undefined;
    if (levels && levels.length) {
      const existing = await prisma.scholarship.update({
        where: { id: r.id },
        data: { studyLevels: JSON.stringify(levels) },
        select: { id: true },
      });
      if (existing) updated++;
      for (const lv of levels) byLevel[lv] = (byLevel[lv] ?? 0) + 1;
    } else {
      stillEmpty++;
    }
  }
  console.log(`updated: ${updated} | still empty: ${stillEmpty}`);
  console.log("level distribution:", byLevel);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
