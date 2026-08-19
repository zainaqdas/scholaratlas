/* Import the curated Scholarships360 records (data/s360/curated.jsonl).
 *
 * These records were hand-curated from Scholarships360's editorial guides
 * about specific named scholarships (Palmetto Fellows, Benacquisto, CalKIDS,
 * NHSC, NCAA Postgraduate, Posse, Skechers, Gates Cambridge) — amounts,
 * eligibility and deadlines reflect only what the article states. The full
 * crawl (data/s360/records.jsonl, scripts/crawl-s360.py) showed the rest of
 * the site is listicles / advice posts / JS-only platform scholarships, which
 * are intentionally not imported.
 *
 * Usage:
 *   npx tsx scripts/import-s360.ts --dry-run
 *   npx tsx scripts/import-s360.ts
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { renewalDecision, applyRenewals } from "./lib/insert-or-renew";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}

const normalizeTitle = (t: string) =>
  t.toLowerCase()
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/\b(?:at|the|of|for|and|program|programme|scholarship|scholarships)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ").trim();

async function main() {
  const rows: any[] = [];
  for (const line of readFileSync("data/s360/curated.jsonl", "utf8").split("\n")) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line));
  }
  console.log(`S360 curated records: ${rows.length}`);

  const existing = await prisma.scholarship.findMany({
    select: { id: true, slug: true, sourceUrl: true, title: true, provider: true, status: true, deadline: true },
  });
  const existingSlugs = new Set(existing.map((r) => r.slug));
  const existingUrls = new Set(existing.map((r) => r.sourceUrl).filter(Boolean) as string[]);
  const existingFp = new Set(
    existing.map((r) => `${(r.title || "").toLowerCase().slice(0, 80)}|${(r.provider || "").toLowerCase().slice(0, 60)}`)
  );
  const existingNorm = existing.map((r) => ({ norm: normalizeTitle(r.title || ""), status: r.status }));
  const existingByUrl = new Map(
    existing.filter((r) => r.sourceUrl).map((r) => [r.sourceUrl as string, r])
  );

  let created = 0, dup = 0, renewed = 0, deadlineUpdated = 0;
  const toCreate: any[] = [];
  const renewals: { id: string; data: any }[] = [];
  const deadlineUpdates: { id: string; deadline: Date }[] = [];
  for (const rec of rows) {
    const title = (rec.title || "").trim();
    if (!title || !rec.officialUrl) continue;

    const baseSlug = `${slugify(title)}-${(rec.country || "xx").toLowerCase()}`;
    let uniqueSlug = baseSlug;
    let i = 2;
    const inBatch = new Set(toCreate.map((c: any) => c.slug));
    while (existingSlugs.has(uniqueSlug) || inBatch.has(uniqueSlug)) uniqueSlug = `${baseSlug}-${i++}`;

    const fp = `${title.toLowerCase().slice(0, 80)}|${(rec.provider || "").toLowerCase().slice(0, 60)}`;

    const lang: any = rec.lang ? { altProof: true } : {};
    const desc = `${rec.desc} Source: Scholarships360 editorial guide (${rec.sourceUrl}). Verify current value, eligibility and deadlines on the official provider website before applying.`;

    const row = {
      slug: uniqueSlug,
      title,
      description: desc,
      provider: (rec.provider || "Scholarships360").slice(0, 150),
      providerType: rec.providerType || "ORGANIZATION",
      countryCode: rec.country || null,
      city: null,
      studyLevels: JSON.stringify(rec.levels || []),
      fields: JSON.stringify(rec.fields || []),
      degrees: "[]",
      eligibleNationalities: JSON.stringify(rec.nationalities || []),
      fundingType: rec.funding || "PARTIAL",
      benefits: JSON.stringify(rec.benefits || []),
      amount: rec.amount || null,
      currency: rec.currency || null,
      duration: rec.duration || null,
      deadline: null,
      deadlineTimezone: null,
      applicationFee: null,
      languageRequirements: JSON.stringify(lang),
      academicRequirements: rec.eligible ? rec.eligible.slice(0, 2000) : null,
      // NOTE: rec.eligible is the eligibility PROSE (shown under "Who Can Apply");
      // rec.nationalities is the ISO country-code list for eligibleNationalities.
      ageRequirements: null,
      workExperience: null,
      requiredDocuments: "[]",
      applicationSteps: "[]",
      officialUrl: rec.officialUrl,
      sourceUrl: rec.sourceUrl,
      verificationStatus: "RECENTLY_UPDATED",
      status: "ACTIVE",
      recordType: "SCHOLARSHIP",
    };

    // Re-crawl of an already-imported record: renew it if it expired and the
    // source still lists it; correct the deadline if it changed mid-cycle.
    const urlMatch = existingByUrl.get(rec.sourceUrl);
    if (urlMatch) {
      const decision = renewalDecision(urlMatch, row);
      if (decision.kind === "renew") {
        renewals.push(decision);
        renewed++;
        console.log(`renew: ${title}`);
      } else if (decision.kind === "update-deadline") {
        deadlineUpdates.push(decision);
        deadlineUpdated++;
      } else {
        dup++;
        console.log(`dup skip (exact): ${title}`);
      }
      continue;
    }
    if (existingFp.has(fp)) {
      dup++;
      console.log(`dup skip (exact): ${title}`);
      continue;
    }
    const myNorm = normalizeTitle(title);
    let fuzzyDup = false;
    for (const e of existingNorm) {
      if (!e.norm || e.norm.length < 18 || e.status !== "ACTIVE") continue;
      const a = e.norm, b = myNorm;
      if (a.length >= 18 && b.length >= 18 && (a.includes(b) || b.includes(a))) {
        fuzzyDup = true;
        console.log(`dup skip (fuzzy): ${title} ~ ${e.norm.slice(0, 60)}`);
        break;
      }
    }
    if (fuzzyDup) { dup++; continue; }

    toCreate.push(row);
    created++;
  }

  if (DRY_RUN) {
    console.log(`to create: ${created}, dups skipped: ${dup}`);
    console.log("DRY RUN — no changes written.");
    return;
  }
  for (const c of toCreate) {
    await prisma.scholarship.create({ data: c });
  }
  console.log(`inserted ${toCreate.length} scholarships`);

  const { renewed: rn, deadlineUpdated: du } = await applyRenewals(renewals, deadlineUpdates);
  console.log(`renewals applied: ${rn}, deadline updates applied: ${du}`);
}

main().finally(() => prisma.$disconnect());
