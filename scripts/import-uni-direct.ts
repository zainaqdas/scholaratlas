/* Import the direct university scholarship records crawled from official
 * university pages in thin-coverage countries (Italy, Japan, Korea,
 * Switzerland) — data/uni_direct/records.jsonl.
 *
 * Every record was hand-curated from the rendered text of the official
 * university page (saved in data/uni_direct/<key>.txt by
 * crawl-uni-direct.py). Amounts, deadlines, eligibility, levels and benefits
 * reflect only what the page states — nothing is guessed.
 *
 * Usage:
 *   npx tsx scripts/import-uni-direct.ts --dry-run
 *   npx tsx scripts/import-uni-direct.ts
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

async function main() {
  const rows: any[] = [];
  for (const line of readFileSync("data/uni_direct/records.jsonl", "utf8").split("\n")) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line));
  }
  console.log(`Direct university records: ${rows.length}`);

  const existing = await prisma.scholarship.findMany({
    select: { slug: true, sourceUrl: true, title: true, provider: true, status: true },
  });
  const existingSlugs = new Set(existing.map((r) => r.slug));
  const existingUrls = new Set(existing.map((r) => r.sourceUrl).filter(Boolean) as string[]);
  const existingFp = new Set(
    existing.map((r) => `${(r.title || "").toLowerCase().slice(0, 80)}|${(r.provider || "").toLowerCase().slice(0, 60)}`)
  );

  // Normalized title for fuzzy dedupe: lowercase, strip years and noise words.
  const normalizeTitle = (t: string) =>
    t
      .toLowerCase()
      .replace(/\b20\d{2}\b/g, " ")
      .replace(/\b(?:at|the|of|for|and|programme|program|scholarship|scholarships)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const existingNorm = existing.map((r) => ({ norm: normalizeTitle(r.title || ""), status: r.status }));

  let created = 0;
  let dup = 0;
  const toCreate: any[] = [];
  for (const rec of rows) {
    const title = (rec.title || "").trim();
    if (!title || !rec.officialUrl) {
      console.log(`skip (no title/url): ${title || rec.key}`);
      continue;
    }

    const countryCode = rec.country || null;
    const baseSlug = `${slugify(title)}-${(countryCode || "xx").toLowerCase()}`;
    let uniqueSlug = baseSlug;
    let i = 2;
    const inBatch = new Set(toCreate.map((c: any) => c.slug));
    while (existingSlugs.has(uniqueSlug) || inBatch.has(uniqueSlug)) uniqueSlug = `${baseSlug}-${i++}`;

    const fp = `${title.toLowerCase().slice(0, 80)}|${(rec.provider || "").toLowerCase().slice(0, 60)}`;
    if (existingUrls.has(rec.sourceUrl) || existingFp.has(fp)) {
      dup++;
      console.log(`dup skip (exact): ${title}`);
      continue;
    }

    // Fuzzy dedupe: if an ACTIVE record's normalized title contains ours (or
    // vice versa) with sufficient length, the program is already covered.
    // EXPIRED records don't block — the current edition is still useful.
    const myNorm = normalizeTitle(title);
    let fuzzyDup = false;
    for (const e of existingNorm) {
      if (!e.norm || e.norm.length < 18) continue;
      if (e.status !== "ACTIVE") continue;
      const a = e.norm, b = myNorm;
      if (a.length >= 18 && b.length >= 18 && (a.includes(b) || b.includes(a))) {
        fuzzyDup = true;
        console.log(`dup skip (fuzzy): ${title} ~ ${e.norm.slice(0, 60)}`);
        break;
      }
    }
    if (fuzzyDup) {
      dup++;
      continue;
    }

    const levels = Array.isArray(rec.levels) ? rec.levels : [];
    const fields = Array.isArray(rec.fields) ? rec.fields : [];
    const benefits = Array.isArray(rec.benefits) ? rec.benefits : [];
    const docs = Array.isArray(rec.docs) ? rec.docs : [];
    const steps = Array.isArray(rec.steps) ? rec.steps : [];
    const lang: any = {};
    if (rec.lang) lang.altProof = true;

    const deadline = rec.deadline ? new Date(rec.deadline) : null;
    // Past deadlines -> EXPIRED (site convention keeps history), else ACTIVE.
    const status = deadline && deadline.getTime() < Date.now() ? "EXPIRED" : "ACTIVE";

    const desc = rec.desc
      ? `${rec.desc} Source: official ${rec.provider} page (${rec.sourceUrl}). Verify current value, eligibility and deadlines on the official website before applying.`
      : `Imported from the official ${rec.provider} page (${rec.sourceUrl}). Verify details on the official website before applying.`;

    toCreate.push({
      slug: uniqueSlug,
      title,
      description: desc,
      provider: (rec.provider || "University").slice(0, 150),
      providerType: "UNIVERSITY",
      countryCode,
      city: null,
      studyLevels: JSON.stringify(levels),
      fields: JSON.stringify(fields),
      degrees: "[]",
      eligibleNationalities: "[]",
      fundingType: rec.funding || "PARTIAL",
      benefits: JSON.stringify(benefits),
      amount: rec.amount || null,
      currency: rec.currency || null,
      duration: rec.duration || null,
      deadline,
      deadlineTimezone: null,
      applicationFee: null,
      languageRequirements: JSON.stringify(lang),
      academicRequirements: rec.eligible ? rec.eligible.slice(0, 2000) : null,
      ageRequirements: rec.age || null,
      workExperience: null,
      requiredDocuments: JSON.stringify(docs),
      applicationSteps: JSON.stringify(steps),
      officialUrl: rec.officialUrl,
      sourceUrl: rec.sourceUrl,
      recordType: "SCHOLARSHIP",
      verificationStatus: "RECENTLY_UPDATED",
      status,
      lastVerifiedAt: new Date(),
      submittedNote: `Imported from the official university page (${rec.sourceUrl}).`,
      createdAt: new Date(),
    });
    created++;
  }

  console.log(`\nto create: ${created}, dups skipped: ${dup}`);

  if (DRY_RUN) {
    console.log("DRY RUN — no changes written.");
    await prisma.$disconnect();
    return;
  }

  // Insert in batches of 10
  for (let i = 0; i < toCreate.length; i += 10) {
    await prisma.scholarship.createMany({ data: toCreate.slice(i, i + 10) });
  }
  console.log(`inserted ${toCreate.length} scholarships`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
