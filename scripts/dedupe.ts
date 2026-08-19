// ---------------------------------------------------------------------------
// Dedupe / un-match script.
//
// Two cleanup passes over the live catalogue:
//
// 1. EXACT DUPLICATES — records with the same normalized (title, provider,
//    country). Happens when the source snapshots contained duplicate rows.
//    Keeps the richest record (ACTIVE status + officialUrl + deadline) and
//    deletes the redundant ones.
//
// 2. OVER-MATCHED CUCAS URLs — when the CUCAS enrichment's substring
//    fallback mapped several records to one program page (e.g. 7 ZAFU
//    records all pointing at the CUCAS "Forestry" page), only the record
//    whose program name exactly matches the URL's program slug keeps the
//    URL+deadline; the others are reset to "Check Official Provider"
//    rather than carry a wrong application link.
//
// Usage:
//   npm run dedupe                 # apply
//   npm run dedupe -- --dry-run    # report only
// ---------------------------------------------------------------------------

import { prisma } from "../src/lib/prisma";
import { duplicateKey, normalizeText } from "../src/lib/dedupe";

const DRY_RUN = process.argv.includes("--dry-run");

const norm = normalizeText;

/** Program part of an imported title like "{Program} — {University} ({Level})". */
function programPart(title: string): string {
  const sep = title.indexOf(" — ");
  return norm(sep > 0 ? title.slice(0, sep) : title);
}

/** Program name embedded in a CUCAS URL slug, e.g. "..._Forestry_scholarship_1490_67955". */
function urlProgram(url: string): string {
  const m = url.match(/china_scholarships?\/(?:[A-Za-z0-9-]+)_([A-Za-z0-9%-]+)_scholarship_/);
  return m ? norm(decodeURIComponent(m[1]).replace(/-/g, " ")) : "";
}

interface Row {
  id: string;
  title: string;
  provider: string;
  countryCode: string | null;
  officialUrl: string | null;
  deadline: Date | null;
  status: string;
}

function richness(r: Row): number {
  let n = 0;
  if (r.status === "ACTIVE") n += 4;
  if (r.officialUrl) n += 2;
  if (r.deadline) n += 2;
  return n;
}

async function main() {
  const rows = (await prisma.scholarship.findMany({
    where: { recordType: "SCHOLARSHIP" },
    select: {
      id: true, title: true, provider: true, countryCode: true,
      officialUrl: true, deadline: true, status: true,
    },
  })) as Row[];
  console.log(`Loaded ${rows.length} scholarship records.`);

  // --- Pass 1: exact duplicates -------------------------------------------
  const byKey = new Map<string, Row[]>();
  for (const r of rows) {
    const k = duplicateKey(r.title, r.provider, r.countryCode);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(r);
  }
  const exactGroups = [...byKey.values()].filter((g) => g.length > 1);
  let toDelete: Row[] = [];
  for (const g of exactGroups) {
    g.sort((a, b) => richness(b) - richness(a));
    toDelete.push(...g.slice(1));
  }
  console.log(`Pass 1 — exact duplicates: ${exactGroups.length} groups, ${toDelete.length} redundant records to delete.`);

  // --- Pass 2: over-matched shared CUCAS URLs ------------------------------
  const byUrl = new Map<string, Row[]>();
  for (const r of rows) {
    if (r.officialUrl && r.officialUrl.includes("cucas.cn")) {
      if (!byUrl.has(r.officialUrl)) byUrl.set(r.officialUrl, []);
      byUrl.get(r.officialUrl)!.push(r);
    }
  }
  const sharedGroups = [...byUrl.values()].filter((g) => g.length > 1);
  let toUnmatch: Row[] = [];
  let unmatchReasons: string[] = [];
  for (const g of sharedGroups) {
    const urlProg = urlProgram(g[0].officialUrl!);
    if (!urlProg) continue;
    // Records whose program name matches the URL's program slug keep the URL
    // (same program at multiple study levels legitimately shares one CUCAS
    // program page, and college-qualified variants like "Chemical Engineering
    // and Technology (College of X)" are the same program). Records that only
    // matched via substring containment in the *other* direction (the record's
    // program is a subset of the URL's, e.g. "History" -> "Chinese History"
    // page) are un-matched — the URL points at a different, more specific
    // program.
    const keep = g.filter((r) => {
      const pp = programPart(r.title).replace(/\band\b/g, " ").replace(/\s+/g, " ").trim();
      const up = urlProg.replace(/\band\b/g, " ").replace(/\s+/g, " ").trim();
      // Keep when the record's program is the same program or a more specific
      // variant of the URL's program (URL is a prefix/substring of the record,
      // e.g. "Chemical Engineering and Technology (College of X)" -> the
      // "Chemical Engineering and Technology" page). Un-match when the record
      // is only a *subset* of the URL's program (e.g. "History" -> the
      // "Chinese History" page) — that points at a different program.
      return pp === up || pp.includes(up);
    });
    const others = g.filter((r) => !keep.some((k) => k.id === r.id));
    for (const o of others) {
      toUnmatch.push(o);
      const kept = keep.length ? keep[0].title.slice(0, 50) : "(no exact match)";
      unmatchReasons.push(`${o.title.slice(0, 50)} -> URL kept on "${kept}" (${urlProg || "?"})`);
    }
  }
  console.log(`Pass 2 — over-matched shared CUCAS URLs: ${sharedGroups.length} groups, ${toUnmatch.length} records to un-match.`);

  if (DRY_RUN) {
    console.log(`[dry-run] delete ${toDelete.length}, un-match ${toUnmatch.length}.`);
    for (const d of toDelete.slice(0, 10)) console.log(`  DEL ${d.title.slice(0, 70)}`);
    for (const m of unmatchReasons.slice(0, 10)) console.log(`  UNMATCH ${m}`);
    return;
  }

  if (toDelete.length) {
    await prisma.scholarship.deleteMany({ where: { id: { in: toDelete.map((r) => r.id) } } });
  }
  if (toUnmatch.length) {
    await prisma.scholarship.updateMany({
      where: { id: { in: toUnmatch.map((r) => r.id) } },
      data: { officialUrl: null, deadline: null, deadlineTimezone: null },
    });
  }
  console.log(`Applied: deleted ${toDelete.length}, unmatched ${toUnmatch.length}.`);
}

main()
  .catch((err) => {
    console.error("Dedupe failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
