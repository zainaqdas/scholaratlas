// Normalize studyLevels JSON to slug format across the whole catalogue.
//
// Some importers wrote display-name levels (["Master's"], ["Undergraduate"],
// ["PhD"]) while the rest use slugs (["masters"], ["undergraduate"], ["phd"]).
// The search filter matches slugs, and card rendering resolves slugs via
// studyLevelFromSlug — so display-name values were invisible to the level
// filter and produced no badge on cards. This script rewrites every record so
// studyLevels only ever contains slugs.
//
// Usage: node scripts/normalize-study-levels.ts
import { prisma } from "../src/lib/prisma";

const DISPLAY_TO_SLUG: Record<string, string> = {
  "High School": "high-school",
  Undergraduate: "undergraduate",
  "Master's": "masters",
  MBA: "mba",
  PhD: "phd",
  Postdoctoral: "postdoctoral",
  Research: "research",
  "Short Course": "short-course",
  "Exchange Program": "exchange-program",
};

const KNOWN_SLUGS = new Set(Object.values(DISPLAY_TO_SLUG));

function normalize(raw: string): string | null {
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(arr)) return null;
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v !== "string") return null;
    const slug = DISPLAY_TO_SLUG[v] ?? v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!KNOWN_SLUGS.has(slug) && !Object.values(DISPLAY_TO_SLUG).includes(slug)) {
      return null; // unknown value — don't touch (avoid corrupting data)
    }
    if (!out.includes(slug)) out.push(slug);
  }
  const next = JSON.stringify(out);
  return next === raw ? null : next;
}

async function main() {
  const rows = await prisma.scholarship.findMany({
    select: { id: true, studyLevels: true },
  });
  let changed = 0;
  for (const r of rows) {
    const next = normalize(r.studyLevels);
    if (next) {
      await prisma.scholarship.update({ where: { id: r.id }, data: { studyLevels: next } });
      changed++;
    }
  }
  console.log(`normalized studyLevels on ${changed} of ${rows.length} records`);
}

main().finally(() => prisma.$disconnect());
