/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// Re-assign countryCode for wemakescholars imports from the detail page's
// "Scholarship can be taken at" field.
//
// The country landing pages list scholarships for studying in that country,
// but a scholarship can appear on several pages (related sidebars), so the
// first-seen page isn't always the true destination. The detail page's
// "Scholarship can be taken at" field names the actual host country/universities.
// This pass re-fetches each record's detail page and:
//   - if "taken at" names a single known country, sets countryCode to it
//   - if it names several countries, keeps the assigned one (still valid)
//   - if it names no country (e.g. "Member institutions"), keeps assigned
//
// Usage:
//   npm run fix:wms-countries -- --dry-run
//   npm run fix:wms-countries
// ---------------------------------------------------------------------------

import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = Number(args[args.indexOf("--limit") + 1] ?? 0) || 0;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// keyword -> country code (order matters: check longer phrases first)
const RULES: [RegExp, string][] = [
  [/\bunited states\b|\bunited states of america\b|\busa\b|\bu\.?s\.?a\.?\b|(?:^|[^a-z])us(?:$|[^a-z])|american universities?\b/i, "US"],
  [/\bunited kingdom\b|\buk\b|britain|england|scotland|wales|northern ireland/i, "GB"],
  [/germany|german universities?/i, "DE"],
  [/france|french universities?/i, "FR"],
  [/canada|canadian universities?/i, "CA"],
  [/australia|australian universities?/i, "AU"],
  [/ireland|irish universities?/i, "IE"],
  [/netherlands|holland|dutch universities?/i, "NL"],
  [/sweden|swedish universities?/i, "SE"],
  [/norway|norwegian universities?/i, "NO"],
  [/finland|finnish universities?/i, "FI"],
  [/switzerland|swiss universities?/i, "CH"],
  [/italy|italian universities?/i, "IT"],
  [/spain|spanish universities?/i, "ES"],
  [/china|chinese universities?/i, "CN"],
  [/japan|japanese universities?/i, "JP"],
  [/south korea|korean universities?/i, "KR"],
  [/singapore/i, "SG"],
  [/new zealand/i, "NZ"],
];

/** Detect all countries mentioned in the "taken at" text, honoring negations
 * like "except Australia" / "outside the United States" / "not in the UK". */
function countriesIn(text: string): string[] {
  const found: string[] = [];
  const negated = new Set<string>();
  const negationRe =
    /(except|excluding|outside|other than|not in|not including|rather than)\s+[a-z ]*?([a-z]+(?:\s+[a-z]+){0,3})/gi;
  let nm: RegExpExecArray | null;
  while ((nm = negationRe.exec(text))) {
    for (const [re, code] of RULES) {
      if (re.test(nm[2])) negated.add(code);
    }
  }
  for (const [re, code] of RULES) {
    if (!negated.has(code) && re.test(text)) found.push(code);
  }
  return found;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function takenAt(html: string): string {
  const m = html.match(
    /<p class="text-line">\s*Scholarship can be taken at:?\s*<\/p>\s*<span class="text-line-value">\s*([\s\S]*?)<\/span>/
  );
  return m
    ? m[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
    : "";
}

async function main() {
  const rows = await prisma.scholarship.findMany({
    where: { sourceUrl: { contains: "wemakescholars.com/scholarship/" } },
    select: { id: true, title: true, countryCode: true, sourceUrl: true },
  });
  console.log(`Loaded ${rows.length} wemakescholars records.`);

  const targets = LIMIT > 0 ? rows.slice(0, LIMIT) : rows;
  const updates: { id: string; from: string; to: string; title: string; taken: string }[] = [];
  let done = 0;

  const CONCURRENCY = 6;
  const queue = [...targets];
  async function worker() {
    for (;;) {
      const r = queue.shift();
      if (!r) return;
      try {
        if (!r.sourceUrl) return;
        const html = await fetchText(r.sourceUrl);
        const taken = takenAt(html);
          if (taken) {
            const codes = countriesIn(taken);
            // Only reassign when the page names exactly ONE country and it
            // differs from the assigned one.
            if (codes.length === 1 && codes[0] !== (r.countryCode ?? "")) {
              updates.push({ id: r.id, from: r.countryCode ?? "", to: codes[0], title: r.title, taken });
            }
          } else {
            // No taken-at field (some pages omit it). Leave the listing-page assignment.
          }
        done += 1;
        if (done % 50 === 0 || done === targets.length) {
          console.log(`  [${done}/${targets.length}] processed, ${updates.length} country fixes so far`, { flush: true } as never);
        }
      } catch {
        /* transient fetch errors: leave as-is */
      }
      await new Promise((res) => setTimeout(res, 200));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Done. ${updates.length} records would change country.`);
  for (const u of updates.slice(0, 15)) {
    console.log(`  ${u.from} -> ${u.to} | ${u.title.slice(0, 55)} | taken at: ${u.taken.slice(0, 50)}`);
  }

  if (DRY_RUN) {
    console.log(`[dry-run] Would update ${updates.length} records.`);
    return;
  }

  for (const u of updates) {
    await prisma.scholarship.update({
      where: { id: u.id },
      data: { countryCode: u.to },
    });
  }
  console.log(`Updated ${updates.length} records.`);
}

main()
  .catch((err) => {
    console.error("Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
