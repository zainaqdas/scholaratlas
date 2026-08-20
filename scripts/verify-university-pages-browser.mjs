// Browser-based re-verification of the FAIL set. Real Chromium passes the WAF
// and anti-bot challenges that blocked the plain-fetch sweep. Reads the fetch
// checkpoint, re-checks every FAIL record one page at a time (sequential, no
// concurrency), appends results to data/url-verification-browser.jsonl
// (resumable via --no-resume to restart).
//
// Usage:
//   node verify-browser.mjs [--max N] [--delay MS]
import { chromium } from "playwright";
import fs from "fs";

const CHECKPOINT = "/home/dgfrii1800/scholaratlas/data/url-verification.jsonl";
const OUT = "/home/dgfrii1800/scholaratlas/data/url-verification-browser.jsonl";
const args = process.argv.slice(2);
const MAX = Number(args[args.indexOf("--max") + 1] ?? 0) || 0;
const DELAY = Number(args[args.indexOf("--delay") + 1] ?? 100) || 100;
const SETTLE = Number(args[args.indexOf("--settle") + 1] ?? 800) || 800;
const NAV_TIMEOUT = Number(args[args.indexOf("--nav-ms") + 1] ?? 15000) || 15000;

const rows = fs.readFileSync(CHECKPOINT, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const fails = rows.filter((r) => r.status === "FAIL");
console.log(`FAIL records: ${fails.length}`);

// Resume: skip ids already in the browser checkpoint.
const done = new Set();
if (fs.existsSync(OUT)) {
  for (const l of fs.readFileSync(OUT, "utf8").split("\n")) {
    if (!l.trim()) continue;
    try { done.add(JSON.parse(l).id); } catch {}
  }
  console.log(`resuming: ${done.size} already checked`);
}
const todo = fails.filter((f) => !done.has(f.id));
console.log(`to check: ${todo.length}`);
if (MAX) {
  todo.length = Math.min(todo.length, MAX);
  console.log(`capped at ${MAX} for this run`);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
});
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  locale: "en-US",
});
const page = await ctx.newPage();

function titleMatch(recordTitle, pageTitle) {
  const words = recordTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 5);
  const t = (pageTitle || "").toLowerCase();
  const hits = words.filter((w) => t.includes(w)).length;
  return { hits, total: words.length, ratio: words.length ? hits / words.length : 0 };
}

const out = fs.openSync(OUT, "a");
let ok = 0, warn = 0, fail = 0, checked = 0;
for (const rec of todo) {
  let http = null;
  let finalUrl = "";
  let pageTitle = "";
  let err = "";
  try {
    const resp = await page.goto(rec.url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    http = resp ? resp.status() : null;
    finalUrl = page.url();
    // Let WAF challenges / JS settle.
    await page.waitForTimeout(SETTLE);
    pageTitle = (await page.title()).trim();
  } catch (e) {
    err = (e.message || "").slice(0, 80);
  }
  const m = titleMatch(rec.title, pageTitle);
  let status;
  let reason;
  if (err) {
    status = "FAIL";
    reason = "ERR " + err;
  } else if (http && http >= 200 && http < 400) {
    if (!pageTitle) { status = "WARN"; reason = "no <title>"; }
    else if (m.ratio >= 0.5) { status = "OK"; reason = `title match ${m.hits}/${m.total}`; }
    else { status = "WARN"; reason = `title match ${m.hits}/${m.total}`; }
  } else {
    status = "FAIL";
    reason = `HTTP ${http ?? "?"}`;
  }
  if (status === "OK") ok++;
  else if (status === "WARN") warn++;
  else fail++;

  const result = {
    id: rec.id, title: rec.title, slug: rec.slug, provider: rec.provider, url: rec.url,
    status, http, finalUrl, pageTitle: pageTitle.slice(0, 200), reason, checkedAt: new Date().toISOString(),
  };
  fs.writeSync(out, JSON.stringify(result) + "\n");
  checked++;
  if (checked % 25 === 0) console.log(`  ...${checked} (ok=${ok} warn=${warn} fail=${fail})`);
  await new Promise((r) => setTimeout(r, DELAY));
}
fs.closeSync(out);
console.log(`\n=== browser pass: ${checked} checked | OK: ${ok} | WARN: ${warn} | FAIL: ${fail} ===`);
await browser.close();
