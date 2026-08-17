/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// Fill amount / currency / benefits for wemakescholars records from the
// cached detail-page descriptions (data/wms-global-details.jsonl).
//
// wms descriptions follow a consistent template:
//   "Apply to {title} which can be taken at {university} and provides {X}"
// where X is one of:
//   - "USD 20,000" / "£3,000" / "up to INR 75,000" / "20% - 30% of tuition"
//   - "Varies"
//   - benefit lists: "Full tuition fee waiver + Stipend + other benefits"
//
// Only the amount/currency/benefits fields are touched — never fabricated.
// "Varies" is recorded verbatim (it is the source's own value).
//
// Usage:
//   npm run backfill:wms-benefits -- --dry-run   # report only
//   npm run backfill:wms-benefits                # apply
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

type Parsed = {
  amount: string | null;
  currency: string | null;
  benefits: string[];
};

const EUR_SYM = "\u20AC"; // €
const GBP_SYM = "\u00A3"; // £
const USD_SYM = "$";
const JPY_SYM = "\u00A5"; // ¥

const CURRENCY_ALIASES: Record<string, string> = {
  [USD_SYM]: "USD",
  "us$": "USD",
  usd: "USD",
  "usd$": "USD",
  [EUR_SYM]: "EUR",
  eur: "EUR",
  [GBP_SYM]: "GBP",
  gbp: "GBP",
  ["gbp" + GBP_SYM]: "GBP",
  cad: "CAD",
  aud: "AUD",
  jpy: "JPY",
  cny: "CNY",
  chf: "CHF",
  inr: "INR",
  myr: "MYR",
  sgd: "SGD",
  nzd: "NZD",
  nok: "NOK",
  sek: "SEK",
  dkk: "DKK",
  ["eur" + EUR_SYM]: "EUR",
};

// Detect a currency + amount in a string. Returns { currency, amount } or null.
function extractAmount(text: string): { currency: string | null; amount: string } | null {
  // Match a currency symbol/code followed by a number, OR a number with a symbol.
  const patterns = [
    // code + number: USD 20,000 / GBP 2,000 (prefer 4+ digit amounts, but accept
    // small ones when a currency code is present — e.g. "£300")
    new RegExp(`(?:(USD|EUR|GBP|CAD|AUD|JPY|CNY|CHF|INR|MYR|SGD|NZD|NOK|SEK|DKK)\\s*)([\\d][\\d,.]*)`, "i"),
    // symbol + number: $10,000 / £3,000 / € 2,500
    new RegExp(`([${EUR_SYM}${GBP_SYM}${USD_SYM}${JPY_SYM}])\\s?([\\d][\\d,.]*)`),
    // number + code: 2,950 MYR / 20,000 USD
    /([\d][\d,.]*)\s*(USD|EUR|GBP|CAD|AUD|JPY|CNY|CHF|INR|MYR|SGD|NZD|NOK|SEK|DKK)/i,
    // bare number of at least 3 digits (e.g. "20% - 30%" excluded by <3 digits)
    /([\d][\d,]{2,})/,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (!m) continue;
    const raw = m[0].trim();
    let currency: string | null = null;
    if (m[1] && /[A-Z]{3}/.test(m[1])) currency = m[1].toUpperCase();
    else if (m[1] && CURRENCY_ALIASES[m[1]]) currency = CURRENCY_ALIASES[m[1]];
    // skip percentages ("20% - 30%")
    if (/%/.test(raw)) return { currency: null, amount: raw };
    return { currency, amount: raw };
  }
  return null;
}

function parseDescription(desc: string): Parsed {
  const benefits: string[] = [];
  let amount: string | null = null;
  let currency: string | null = null;

  const lower = desc.toLowerCase();

  // "provides ..." tail
  const m = desc.match(/provides\s+(.+)$/i);
  const tail = m ? m[1] : desc;

  // 1. "Varies" — record verbatim, no benefits.
  if (/^\s*varies\b/i.test(tail)) {
    return { amount: "Varies", currency: null, benefits: [] };
  }

  // 2. Amount extraction.
  const amt = extractAmount(tail);
  if (amt) {
    amount = amt.amount;
    currency = amt.currency;
  }

  // 3. Benefits (only when the text clearly says so).
  if (/\b(full\s+)?tuition\b|fee\s*waiver|tuition\s*fees?\b|full\s+fees?\b|tuition\s*charges|tuition\s*reduction|fees?\s*discount|full\s*tuition/i.test(lower)) {
    benefits.push("tuition");
  }
  if (/\bstipend\b|allowances?\b|living\s*expenses|maintenance\b|monthly\s*allowance/i.test(lower)) {
    benefits.push("stipend");
  }
  if (/\baccommodation\b|housing\b|lodging\b|on-campus\s*housing|board\s*and\s*lodging/i.test(lower)) {
    benefits.push("accommodation");
  }
  if (/\binsurance\b|health\s*insurance/i.test(lower)) {
    benefits.push("insurance");
  }
  if (/\bairfare\b|\bair\s*fare\b|\btravel\s*grant\b|\bflight\s*tickets?\b|\bair\s*tickets?\b|\breturn\s*tickets?\b/i.test(lower)) {
    benefits.push("airfare");
  }
  if (/\bvisa\s*support\b|\bvisa\s*fee\b/i.test(lower)) {
    benefits.push("visaSupport");
  }
  if (/\bresearch\s*allowance\b|research\s*training\s*support\b|\bresearch\s*grant\b/i.test(lower)) {
    benefits.push("researchAllowance");
  }

  return { amount, currency, benefits };
}

async function main() {
  // Load cached descriptions.
  let rows: { sourceUrl: string; description?: string | null }[] = [];
  try {
    const raw = readFileSync("data/wms-global-details.jsonl", "utf-8");
    rows = raw
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { sourceUrl: string; description?: string | null });
  } catch {
    console.error("Could not read data/wms-global-details.jsonl — aborting.");
    process.exit(1);
  }
  console.log(`Cached wms details: ${rows.length}`);

  // Build sourceUrl -> parsed.
  const parsedByUrl = new Map<string, Parsed>();
  for (const r of rows) {
    if (!r.sourceUrl) continue;
    parsedByUrl.set(r.sourceUrl, parseDescription(r.description ?? ""));
  }
  console.log(`Parsed descriptions: ${parsedByUrl.size}`);

  // Find wms records with empty amount AND empty benefits.
  const records = await prisma.scholarship.findMany({
    where: {
      sourceUrl: { contains: "wemakescholars" },
      OR: [{ amount: null }, { benefits: "[]" }],
    },
    select: { id: true, sourceUrl: true, amount: true, benefits: true },
  });
  console.log(`wms records with missing amount/benefits: ${records.length}`);

  const updates: { id: string; amount: string | null; currency: string | null; benefits: string }[] = [];
  let withAmount = 0;
  let withBenefits = 0;

  for (const rec of records) {
    if (!rec.sourceUrl) continue;
    const parsed = parsedByUrl.get(rec.sourceUrl);
    if (!parsed) continue;
    const benefits = JSON.stringify(parsed.benefits);
    const amount = parsed.amount ?? rec.amount;
    const currency = parsed.currency ?? null;
    // only update if something changed
    const hasAmount = amount !== null && amount !== rec.amount;
    const hasBenefits = parsed.benefits.length > 0 && benefits !== rec.benefits;
    if (!hasAmount && !hasBenefits) continue;
    if (amount !== null && amount !== rec.amount) withAmount++;
    if (parsed.benefits.length > 0) withBenefits++;
    updates.push({ id: rec.id, amount, currency, benefits });
  }

  console.log(`Records to update: ${updates.length} (amount: ${withAmount}, benefits: ${withBenefits})`);

  if (DRY_RUN) {
    for (const u of updates.slice(0, 10)) console.log(`  [dry-run] ${u.id} -> ${u.amount} | ${u.benefits}`);
    return;
  }

  let applied = 0;
  const BATCH = 250;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((u) =>
        prisma.scholarship.update({
          where: { id: u.id },
          data: { amount: u.amount, currency: u.currency, benefits: u.benefits, updatedAt: new Date() },
        }),
      ),
    );
    applied += batch.length;
    console.log(`Applied ${applied}/${updates.length}...`);
  }
  console.log(`Done: updated ${applied} records.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
