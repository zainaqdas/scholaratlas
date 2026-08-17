/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// wms deadline backfill from the crawled "Deadline:" spec
// (data/wms-deadlines.jsonl — all 20,451 detail pages).
//
// Two cases:
//   1. Real date (e.g. "01 Dec, 2026") -> set deadline (only if currently null).
//   2. "Expired" -> the SOURCE marks the scholarship closed. Per the product
//      spec (§62 Expiration System) such records get status=EXPIRED, stay in
//      the DB for SEO/history, and the detail page shows "Closed" + similar
//      active scholarships.
//
// Only records still lacking a deadline are touched for dates; EXPIRED is
// applied to records the source marks expired regardless of current status.
//
// Usage:
//   npm run backfill:wms-deadlines -- --dry-run
//   npm run backfill:wms-deadlines
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDeadline(raw: string): Date | null {
  // "01 Dec, 2026" or "Dec 01, 2026"
  let m = raw.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s+(\d{4})/);
  let day: number, month: number, year: number;
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] !== undefined) {
    day = Number(m[1]);
    month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    year = Number(m[3]);
  } else {
    m = raw.match(/([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})/);
    if (!m || MONTHS[m[1].slice(0, 3).toLowerCase()] === undefined) return null;
    day = Number(m[2]);
    month = MONTHS[m[1].slice(0, 3).toLowerCase()];
    year = Number(m[3]);
  }
  if (Number.isNaN(day) || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month, day, 23, 59, 0));
}

async function main() {
  // Load crawled deadlines.
  const rows: { slug: string; deadline: string | null }[] = [];
  try {
    const raw = readFileSync("data/wms-deadlines.jsonl", "utf-8");
    for (const line of raw.split("\n").filter(Boolean)) {
      const r = JSON.parse(line) as { slug: string; deadline?: string | null };
      rows.push({ slug: r.slug, deadline: r.deadline ?? null });
    }
  } catch {
    console.error("Could not read data/wms-deadlines.jsonl — aborting.");
    process.exit(1);
  }
  console.log(`Crawled deadlines: ${rows.length}`);

  // slug -> { date?, expired }
  const bySlug = new Map<string, { date: Date | null; expired: boolean }>();
  let withDate = 0;
  let expired = 0;
  for (const r of rows) {
    if (!r.deadline || r.deadline.startsWith("ERR")) continue;
    if (/expired/i.test(r.deadline)) {
      bySlug.set(r.slug, { date: null, expired: true });
      expired++;
      continue;
    }
    const d = parseDeadline(r.deadline);
    if (d) {
      bySlug.set(r.slug, { date: d, expired: false });
      withDate++;
    }
  }
  console.log(`Parseable: ${withDate} real dates, ${expired} source-expired.`);

  // wms records
  const records = await prisma.scholarship.findMany({
    where: { sourceUrl: { contains: "wemakescholars" } },
    select: { id: true, sourceUrl: true, deadline: true, status: true },
  });
  console.log(`wms records: ${records.length}`);

  const deadlineUpdates: { id: string; deadline: Date }[] = [];
  const expiredUpdates: string[] = [];
  const expiring: { id: string; deadline: Date }[] = [];

  for (const rec of records) {
    if (!rec.sourceUrl) continue;
    const slug = rec.sourceUrl.split("/").pop();
    if (!slug) continue;
    const info = bySlug.get(slug);
    if (!info) continue;
    if (info.expired) {
      if (rec.status !== "EXPIRED") expiredUpdates.push(rec.id);
      continue;
    }
    if (!info.date) continue;
    if (!rec.deadline) deadlineUpdates.push({ id: rec.id, deadline: info.date });
    else if (rec.status !== "EXPIRED" && info.date.getTime() !== rec.deadline.getTime()) {
      // date present but stale/different — refresh if the source date is newer
      expiring.push({ id: rec.id, deadline: info.date });
    }
  }

  console.log(`Set deadline on ${deadlineUpdates.length} records (was missing).`);
  console.log(`Mark EXPIRED on ${expiredUpdates.length} records (source says Expired).`);
  console.log(`Refresh stale deadline on ${expiring.length} records.`);

  if (DRY_RUN) {
    for (const u of deadlineUpdates.slice(0, 5)) console.log(`  [dry-run] deadline ${u.id} -> ${u.deadline.toISOString().slice(0, 10)}`);
    for (const id of expiredUpdates.slice(0, 5)) console.log(`  [dry-run] EXPIRED ${id}`);
    return;
  }

  const BATCH = 250;

  if (deadlineUpdates.length) {
    for (let i = 0; i < deadlineUpdates.length; i += BATCH) {
      const batch = deadlineUpdates.slice(i, i + BATCH);
      await prisma.$transaction(
        batch.map((u) =>
          prisma.scholarship.update({ where: { id: u.id }, data: { deadline: u.deadline, deadlineTimezone: "UTC", updatedAt: new Date() } }),
        ),
      );
    }
    console.log(`Applied ${deadlineUpdates.length} deadline updates.`);
  }

  if (expiredUpdates.length) {
    for (let i = 0; i < expiredUpdates.length; i += BATCH) {
      const batch = expiredUpdates.slice(i, i + BATCH);
      await prisma.$transaction(
        batch.map((id) =>
          prisma.scholarship.update({ where: { id }, data: { status: "EXPIRED", updatedAt: new Date() } }),
        ),
      );
    }
    console.log(`Applied EXPIRED on ${expiredUpdates.length} records.`);
  }

  if (expiring.length) {
    for (let i = 0; i < expiring.length; i += BATCH) {
      const batch = expiring.slice(i, i + BATCH);
      await prisma.$transaction(
        batch.map((u) =>
          prisma.scholarship.update({ where: { id: u.id }, data: { deadline: u.deadline, deadlineTimezone: "UTC", updatedAt: new Date() } }),
        ),
      );
    }
    console.log(`Refreshed ${expiring.length} stale deadlines.`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
