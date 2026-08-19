import { createManySkipDuplicates } from "./lib/insert-many";
import { renewalDecision, applyRenewals } from "./lib/insert-or-renew";
/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// chinesescholarshipcouncil.com importer — per-university CSC scholarship pages.
//
// This third-party site maintains a page per Chinese university describing the
// Chinese Government Scholarship (CSC) at that university: deadline, coverage,
// monthly allowance, documents, apply method. It is NOT an official source —
// deadlines are generic ("30 April Each Year") and content is SEO-style, so
// imported records are UNVERIFIED with the source URL preserved, and the
// official CSC/campuschina link is attached when the page carries one.
//
// Imported records land as PENDING/UNVERIFIED for admin review. Dedupes by
// source URL (idempotent).
//
// Usage:
//   npm run import:cscouncil                   # full run
//   npm run import:cscouncil -- --dry-run      # report only
//   npm run import:cscouncil -- --limit 10     # cap pages fetched
// ---------------------------------------------------------------------------

import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/utils";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = Number(args[args.indexOf("--limit") + 1] ?? 0) || 0;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const BASE = "https://www.chinesescholarshipcouncil.com";
const SITEMAPS = ["post-sitemap1.xml", "post-sitemap2.xml", "post-sitemap3.xml", "page-sitemap.xml"];

const EXCLUDE = /result|list|sample|letter|subject|acceptance|deadline|requirements|how-to-apply|how-to-write|great-college-application|essay|faq|questions|can-|what-|when-|agency|professors|email|cover-|recommendation|council|news|about|contact|privacy|terms|home|more-than-one|apply-for-csc|samples|download|postdoc|post-doc|vacancy|position|job|employment|researcher/i;
const INCLUDE = /(^|-)university|college|institute/;

interface CscRecord {
  title: string;
  slug: string;
  universityName: string;
  provider: string;
  fundingType: string;
  deadline: Date | null;
  amount: string | null;
  description: string;
  officialUrl: string | null;
  sourceUrl: string;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** All .html page URLs from the sitemaps. */
async function collectPageUrls(): Promise<string[]> {
  const urls = new Set<string>();
  for (const sm of SITEMAPS) {
    try {
      const xml = await fetchText(`${BASE}/${sm}`);
      for (const m of xml.matchAll(/<loc>(https:\/\/www\.chinesescholarshipcouncil\.com\/[a-z0-9-]+\.html)<\/loc>/g)) {
        urls.add(m[1]);
      }
    } catch (e) {
      console.error(`  sitemap ${sm} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  return [...urls];
}

function toSlug(s: string): string {
  return s.toLowerCase().replace(/&/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function visibleText(html: string): string {
  let t = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/&amp;/g, "&").replace(/&#8217;|&#039;/g, "'").replace(/&nbsp;/g, " ");
  return t.replace(/\s+/g, " ").trim();
}

function titleFrom(html: string): string {
  const m = html.match(/<title>([^<]+)<\/title>/);
  return m ? m[1].trim() : "";
}

function metaDescription(html: string): string {
  const m = html.match(/<meta name="description" content="([^"]*)"/);
  return m ? m[1].replace(/&amp;/g, "&").trim() : "";
}

/** First external official-ish link (campuschina / studyinchina / university site). */
function officialUrl(html: string): string | null {
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    const url = m[1];
    if (/chinesescholarshipcouncil\.com|facebook\.com|twitter\.com|instagram\.com|youtube\.com|linkedin\.com|pinterest|w3\.org|schema\.org|cloudflare|googleapis|googletagmanager\.com|google-analytics\.com|googlesyndication\.com|pagead2|gstatic\.com|doubleclick\.net|bootstrapcdn|wp-content|\.(png|jpg|jpeg|gif|css|js|svg|ico|woff2?)$/i.test(url)) {
      continue;
    }
    return url;
  }
  return null;
}

/** "30 April" (no year) -> next occurrence (this year or next). */
function parseMonthDay(raw: string): Date | null {
  const m = raw.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})/i);
  if (!m) return null;
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const month = months[m[1].slice(0, 3).toLowerCase()];
  const day = Number(m[2]);
  if (month === undefined || Number.isNaN(day) || day < 1 || day > 31) return null;
  const now = new Date();
  let year = now.getUTCFullYear();
  let d = new Date(Date.UTC(year, month, day, 23, 59, 0));
  if (d.getTime() < now.getTime()) {
    year += 1;
    d = new Date(Date.UTC(year, month, day, 23, 59, 0));
  }
  return d;
}

function extractDeadline(text: string): Date | null {
  const m = text.match(/Application Deadline is:?\s*([A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)/i);
  if (m) return parseMonthDay(m[1]);
  const m2 = text.match(/(?:deadline|closing date)[^.]{0,60}?([A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)/i);
  if (m2) return parseMonthDay(m2[1]);
  return null;
}

function extractAmount(text: string): string | null {
  const m = text.match(/Monthly Allowance[^.]{0,120}/i);
  return m ? m[0].replace(/\s+/g, " ").trim() : null;
}

function extractFunding(text: string): string {
  if (/fully funded|everything is free|full scholarship/i.test(text)) return "FULLY_FUNDED";
  if (/partial/i.test(text)) return "PARTIAL";
  if (/tuition/i.test(text)) return "TUITION_WAIVER";
  return "PARTIAL";
}

function universityFromTitle(title: string, slug: string): string {
  let t = title.replace(/CSC Scholarship.*$/i, "").replace(/Scholarship.*$/i, "").trim();
  t = t.replace(/\s*202[0-9].*$/i, "").trim();
  if (t) return t;
  // fall back to slug: split on known suffixes
  const s = slug.replace(/\.html$/, "").replace(/-csc-scholarship.*$/i, "").replace(/-scholarship.*$/i, "");
  return s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

async function parsePage(url: string): Promise<CscRecord | null> {
  const html = await fetchText(url);
  const title = titleFrom(html) || (html.match(/<h1[^>]*>([^<]+)<\/h1>/) ?? [])[1]?.trim() || "";
  if (!title) return null;

  const text = visibleText(html);
  const slug = url.replace(/^.*\//, "");
  const universityName = universityFromTitle(title, slug);
  const deadline = extractDeadline(text);
  const description = metaDescription(html) || text.slice(0, 400);
  // Pages whose <title> is just the university name are CSC scholarship pages
  // on this site — make that explicit in the record title.
  const finalTitle = /scholarship|fellowship|funding/i.test(title)
    ? title.replace(/&amp;/g, "&")
    : `${title.replace(/&amp;/g, "&")} CSC Scholarship`;

  return {
    title: finalTitle,
    slug: slugify(title),
    universityName,
    provider: "China Scholarship Council (CSC)",
    fundingType: extractFunding(text),
    deadline,
    amount: extractAmount(text),
    description,
    officialUrl: officialUrl(html),
    sourceUrl: url,
  };
}

async function main() {
  console.log("Collecting page URLs from sitemaps...");
  const all = await collectPageUrls();
  const pages = all.filter((u) => {
    const slug = u.replace(/^.*\//, "");
    return INCLUDE.test(slug) && !EXCLUDE.test(slug);
  });
  console.log(`Sitemap URLs: ${all.length} | university scholarship pages: ${pages.length}`);

  const targets = LIMIT > 0 ? pages.slice(0, LIMIT) : pages;
  const records: CscRecord[] = [];
  let failed = 0;
  for (const url of targets) {
    try {
      const rec = await parsePage(url);
      if (rec) {
        records.push(rec);
        console.log(`  ${rec.universityName.slice(0, 40)} | ${rec.fundingType} | dl=${rec.deadline?.toISOString().slice(0, 10) ?? "-"}`);
      }
    } catch (e) {
      failed += 1;
      console.error(`  failed ${url}: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`Parsed ${records.length} records (${failed} failed).`);

  // Link to existing University records by normalized name.
  const universities = await prisma.university.findMany({ select: { id: true, name: true, countryCode: true } });
  const uniBySlug = new Map(universities.map((u) => [toSlug(u.name), u]));
  const withUniversity = records.map((r) => ({
    ...r,
    university: uniBySlug.get(toSlug(r.universityName)) ?? null,
  }));
  const linked = withUniversity.filter((r) => r.university).length;
  console.log(`Linked to existing University records: ${linked}/${records.length}`);

  if (DRY_RUN) {
    console.log(`[dry-run] Would insert ${records.length} records (${linked} linked to universities).`);
    return;
  }

  const existing = await prisma.scholarship.findMany({
    where: { sourceUrl: { in: records.map((r) => r.sourceUrl) } },
    select: { id: true, sourceUrl: true, status: true, deadline: true },
  });
  const existingByUrl = new Map(existing.map((e) => [e.sourceUrl as string, e]));

  // Dedupe by source URL; re-crawled expired records are renewed in place so
  // they come back to the catalogue instead of being skipped as duplicates.
  const fresh: any[] = [];
  const renewals: { id: string; data: any }[] = [];
  const deadlineUpdates: { id: string; deadline: Date }[] = [];
  let unchanged = 0;
  for (const r of withUniversity) {
    const row = {
      title: r.title,
      slug: r.slug,
      description: r.description,
      provider: r.provider,
      providerType: "GOVERNMENT",
      countryCode: "CN",
      universityId: r.university?.id ?? null,
      fundingType: r.fundingType,
      amount: r.amount,
      deadline: r.deadline,
      deadlineTimezone: r.deadline ? "UTC" : null,
      eligibleNationalities: '["ALL"]',
      officialUrl: r.officialUrl,
      sourceUrl: r.sourceUrl,
      status: "PENDING",
      verificationStatus: "UNVERIFIED",
      recordType: "SCHOLARSHIP",
      submittedNote: `Imported from chinesescholarshipcouncil.com (third-party, unverified) on ${new Date().toISOString().slice(0, 10)}`,
    };
    const match = existingByUrl.get(r.sourceUrl);
    if (!match) {
      fresh.push(row);
      continue;
    }
    const decision = renewalDecision(match, row);
    if (decision.kind === "renew") renewals.push(decision);
    else if (decision.kind === "update-deadline") deadlineUpdates.push(decision);
    else unchanged++;
  }

  let inserted = 0;
  if (fresh.length) {
    inserted = await createManySkipDuplicates(prisma.scholarship, fresh);
  }
  const { renewed: rn, deadlineUpdated: du } = await applyRenewals(renewals, deadlineUpdates);
  console.log(`New: ${fresh.length} | Already imported (unchanged): ${unchanged} | Renewed: ${rn} | Deadlines updated: ${du} | Inserted: ${inserted}`);
}

main()
  .catch((err) => {
    console.error("Import failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
