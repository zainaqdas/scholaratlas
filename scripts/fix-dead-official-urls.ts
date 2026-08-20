// Fix: null officialUrls that the verification sweep proved dead (HTTP 404).
//
// Reads the checkpoint produced by scripts/verify-university-pages.ts,
// collects every FAIL with reason "HTTP 404", confirms the origin host is
// still alive (so we only null genuinely-moved/gone pages, not whole dead
// sites), then sets officialUrl to null — the detail page then shows "Check
// the provider's own website" instead of a broken Apply link. The record's
// aggregator sourceUrl is untouched, so provenance survives.
//
// Usage:
//   npm run fix:dead-official-urls -- --dry-run
//   npm run fix:dead-official-urls
import { prisma } from "../src/lib/prisma";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const CHECKPOINT = path.resolve(args[args.indexOf("--checkpoint") + 1] ?? "data/url-verification.jsonl");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function originAlive(url: string): Promise<boolean> {
  try {
    const origin = new URL(url).origin;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(origin, { redirect: "follow", signal: ctrl.signal, headers: { "user-agent": UA } });
    clearTimeout(t);
    return res.ok || res.status === 403 || res.status === 401 || res.status === 405;
  } catch {
    return false;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!fs.existsSync(CHECKPOINT)) {
    console.error("no checkpoint — run scripts/verify-university-pages.ts first");
    process.exit(1);
  }

  const results = fs
    .readFileSync(CHECKPOINT, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const dead = results.filter((r) => r.status === "FAIL" && r.reason === "HTTP 404");
  console.log(`dead 404 records in checkpoint: ${dead.length}`);

  const toNull: { id: string; title: string; url: string }[] = [];
  for (const r of dead) {
    if (await originAlive(r.url)) {
      toNull.push({ id: r.id, title: r.title, url: r.url });
    } else {
      console.log(`  (origin down too — leaving) ${r.title.slice(0, 50)} | ${r.url.slice(0, 70)}`);
    }
  }
  console.log(`origin-alive, nulling: ${toNull.length}`);
  for (const t of toNull) console.log(`  - ${t.title.slice(0, 55)} | ${t.url.slice(0, 75)}`);

  if (dryRun) {
    console.log("\n(dry-run — no writes)");
    await prisma.$disconnect();
    return;
  }
  if (toNull.length) {
    const upd = await prisma.scholarship.updateMany({
      where: { id: { in: toNull.map((t) => t.id) }, officialUrl: { not: null } },
      data: { officialUrl: null, updatedAt: new Date() },
    });
    console.log(`\nNulled ${upd.count} dead officialUrls`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
