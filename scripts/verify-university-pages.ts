// Verify university programme pages directly — one URL at a time, never bulk.
//
// Fetches each record's officialUrl (the university's own programme page, not
// the aggregator), follows redirects, and classifies the result:
//   OK    — HTTP 200 and the page title contains the scholarship's key words
//   WARN  — HTTP 200 but the page title doesn't clearly match the programme
//   FAIL  — non-200, timeout, or network error (dead link / wrong URL)
//
// The pass is strictly sequential (one fetch at a time, no concurrency — bulk
// crawling is what times out on university sites). Progress is checkpointed to
// data/url-verification.jsonl so a re-run resumes where it stopped. Summary
// lists are written to data/verified-ok.tsv and data/verified-fail.tsv.
//
// Usage:
//   npx tsx scripts/verify-university-pages.ts --hosts 60        # top-N hosts by record count
//   npx tsx scripts/verify-university-pages.ts --hosts all       # every host (long)
//   npx tsx scripts/verify-university-pages.ts --hosts all --cap 3   # max 3 URLs per host
//   npx tsx scripts/verify-university-pages.ts --dry-run         # report scope only
import { prisma } from "../src/lib/prisma";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const HOSTS_ARG = args[args.indexOf("--hosts") + 1] ?? "60";
const CAP = Number(args[args.indexOf("--cap") + 1] ?? 0) || 0;
const DRY_RUN = args.includes("--dry-run");
const RESUME = !args.includes("--no-resume");

const CHECKPOINT = path.resolve("data/url-verification.jsonl");
const OK_LIST = path.resolve("data/verified-ok.tsv");
const FAIL_LIST = path.resolve("data/verified-fail.tsv");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

interface Result {
  id: string;
  title: string;
  slug: string;
  provider: string;
  url: string;
  host: string;
  status: "OK" | "WARN" | "FAIL";
  http?: number;
  finalUrl?: string;
  pageTitle?: string;
  reason?: string;
  checkedAt: string;
}

const done = new Set<string>();
if (RESUME && fs.existsSync(CHECKPOINT)) {
  for (const line of fs.readFileSync(CHECKPOINT, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as Result;
      done.add(r.id);
    } catch {}
  }
  console.log(`resuming: ${done.size} records already checked`);
}

async function checkOne(rec: {
  id: string;
  title: string;
  slug: string;
  provider: string;
  url: string;
}): Promise<Result> {
  const base: Result = {
    id: rec.id,
    title: rec.title,
    slug: rec.slug,
    provider: rec.provider,
    url: rec.url,
    host: "",
    status: "FAIL",
    checkedAt: new Date().toISOString(),
  };
  try {
    base.host = new URL(rec.url).hostname.replace(/^www\./, "");
  } catch {
    base.reason = "malformed URL";
    return base;
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(rec.url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    });
    clearTimeout(t);
    base.http = res.status;
    base.finalUrl = res.url;
    if (!res.ok) {
      base.reason = `HTTP ${res.status}`;
      return base;
    }
    const html = await res.text();
    // Strip tags for a cheap title
    const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const pageTitle = m ? m[1].trim() : "";
    base.pageTitle = pageTitle.slice(0, 200);
    if (!pageTitle) {
      base.reason = "no <title> in page";
      base.status = "WARN";
      return base;
    }
    // Keyword match: words from the record title (>=5 chars) vs page title.
    const words = rec.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 5);
    const titleLower = pageTitle.toLowerCase();
    const hits = words.filter((w) => titleLower.includes(w)).length;
    const ratio = words.length ? hits / words.length : 0;
    if (ratio >= 0.5) {
      base.status = "OK";
      base.reason = `title match ${hits}/${words.length}`;
    } else {
      base.status = "WARN";
      base.reason = `title match ${hits}/${words.length}`;
    }
  } catch (e) {
    clearTimeout(t);
    base.reason = e instanceof Error ? e.name + ": " + e.message.slice(0, 60) : "error";
  }
  return base;
}

async function main() {
  const rows = await prisma.scholarship.findMany({
    where: { officialUrl: { not: null }, status: "ACTIVE", recordType: "SCHOLARSHIP" },
    select: { id: true, title: true, slug: true, provider: true, officialUrl: true },
  });
  console.log(`records with officialUrl: ${rows.length}`);

  // Normalize to { id, title, slug, provider, url }.
  const recs = rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    provider: r.provider,
    url: r.officialUrl!,
  }));

  // Group by host, ordered by record count desc, then by title.
  const byHost = new Map<string, typeof recs>();
  for (const r of recs) {
    let host = "";
    try {
      host = new URL(r.url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host)!.push(r);
  }
  const hosts = [...byHost.entries()].sort((a, b) => b[1].length - a[1].length);

  const hostLimit = HOSTS_ARG === "all" ? hosts.length : Number(HOSTS_ARG);
  const selected = hosts.slice(0, hostLimit);
  let planned = 0;
  for (const [, recs] of selected) planned += CAP ? Math.min(CAP, recs.length) : recs.length;
  console.log(`hosts selected: ${selected.length} (of ${hosts.length}); URLs planned: ${planned}`);
  if (DRY_RUN) {
    await prisma.$disconnect();
    return;
  }

  const out = fs.openSync(CHECKPOINT, "a");
  const results: Result[] = [];
  let doneInRun = 0;
  let ok = 0;
  let warn = 0;
  let fail = 0;
  const failReasons = new Map<string, number>();

  for (const [host, recs] of selected) {
    const urls = CAP ? recs.slice(0, CAP) : recs;
    for (const rec of urls) {
      if (done.has(rec.id)) continue; // resume
      const res = await checkOne(rec);
      done.add(rec.id);
      doneInRun++;
      results.push(res);
      fs.writeSync(out, JSON.stringify(res) + "\n");
      if (res.status === "OK") ok++;
      else if (res.status === "WARN") warn++;
      else {
        fail++;
        failReasons.set(res.reason ?? "?", (failReasons.get(res.reason ?? "?") ?? 0) + 1);
      }
      if (doneInRun % 50 === 0) {
        console.log(`  ...${doneInRun} checked (ok=${ok} warn=${warn} fail=${fail})`);
      }
      // Polite pacing — one request at a time, no burst.
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  fs.closeSync(out);

  // Write the two lists.
  const okLines = ["id\ttitle\tslug\tprovider\turl\thttp\tfinalUrl\tpageTitle\treason"];
  const failLines = ["id\ttitle\tslug\tprovider\turl\thttp\tfinalUrl\tpageTitle\tstatus\treason"];
  for (const r of results) {
    const row = [r.id, r.title, r.slug, r.provider, r.url, r.http ?? "", r.finalUrl ?? "", r.pageTitle ?? "", r.reason ?? ""]
      .map((v) => String(v).replace(/\t/g, " ").replace(/\n/g, " "))
      .join("\t");
    if (r.status === "OK") okLines.push(row);
    else failLines.push(row);
  }
  fs.writeFileSync(OK_LIST, okLines.join("\n") + "\n");
  fs.writeFileSync(FAIL_LIST, failLines.join("\n") + "\n");

  console.log(`\n=== pass complete: checked ${doneInRun} (resumed past ${done.size - doneInRun}) ===`);
  console.log(`OK: ${ok} | WARN: ${warn} | FAIL: ${fail}`);
  console.log("fail reasons:");
  for (const [r, n] of [...failReasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(4)}  ${r}`);
  console.log(`\nlists: ${OK_LIST} / ${FAIL_LIST}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
