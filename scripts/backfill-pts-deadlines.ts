// ---------------------------------------------------------------------------
// Apply PathwaysToScience deadlines from data/pts-deadlines.jsonl.
// Only machine-readable dates ("8/1/2026") and explicit cycle lists
// (e.g. "May 22, 2026") are used — free-text "see website" mentions are not.
//
// Usage:
//   npm run backfill:pts-deadlines -- --dry-run
//   npm run backfill:pts-deadlines
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDate(raw: string): Date | null {
  // "8/1/2026"
  let m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const month = Number(m[1]) - 1;
    const day = Number(m[2]);
    const year = Number(m[3]);
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month, day, 23, 59, 0));
    }
    return null;
  }
  // "May 22, 2026" (first date in a cycle list)
  m = raw.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()] !== undefined) {
    const day = Number(m[2]);
    const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
    const year = Number(m[3]);
    if (day >= 1 && day <= 31) return new Date(Date.UTC(year, month, day, 23, 59, 0));
  }
  return null;
}

async function main() {
  const rows: { sourceUrl: string; deadline: string | null; kind: string }[] = [];
  try {
    const raw = readFileSync("data/pts-deadlines.jsonl", "utf-8");
    for (const line of raw.split("\n").filter(Boolean)) {
      const r = JSON.parse(line) as { sourceUrl: string; deadline?: string | null; kind?: string };
      rows.push({ sourceUrl: r.sourceUrl, deadline: r.deadline ?? null, kind: r.kind ?? "none" });
    }
  } catch {
    console.error("Could not read data/pts-deadlines.jsonl — aborting.");
    process.exit(1);
  }

  // Only machine + cycles kinds are trustworthy dates.
  const byUrl = new Map<string, Date>();
  for (const r of rows) {
    if (!r.deadline || r.deadline.startsWith("ERR")) continue;
    if (r.kind !== "machine" && r.kind !== "cycles") continue;
    const d = parseDate(r.deadline);
    if (d) byUrl.set(r.sourceUrl, d);
  }
  console.log(`Trustworthy PTS deadlines: ${byUrl.size}`);

  const records = await prisma.scholarship.findMany({
    where: { sourceUrl: { in: [...byUrl.keys()] }, deadline: null },
    select: { id: true, sourceUrl: true },
  });
  console.log(`PTS records missing deadline (of those with a source date): ${records.length}`);

  const updates = records
    .map((r) => ({ id: r.id, deadline: byUrl.get(r.sourceUrl!)! }))
    .filter((u) => u.deadline);

  if (DRY_RUN) {
    for (const u of updates.slice(0, 5)) console.log(`  [dry-run] ${u.id} -> ${u.deadline.toISOString().slice(0, 10)}`);
    console.log(`Would update ${updates.length} records.`);
    return;
  }

  const BATCH = 100;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((u) =>
        prisma.scholarship.update({ where: { id: u.id }, data: { deadline: u.deadline, deadlineTimezone: "UTC", updatedAt: new Date() } }),
      ),
    );
  }
  console.log(`Done: set deadline on ${updates.length} PTS records.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
