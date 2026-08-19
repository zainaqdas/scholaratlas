import { createManySkipDuplicates } from "./lib/insert-many";
import { renewalDecision, applyRenewals } from "./lib/insert-or-renew";
/* Import the official Study in Sweden scholarship database (60 scholarships)
 * from data/studyinsweden/scholarships.jsonl (extracted from the site's
 * embedded Next.js data — cms.studyinsweden.se is the official Swedish
 * government guide to studying in Sweden).
 *
 * Maps each record to the Scholarship schema:
 *   title            -> title
 *   title-derived    -> provider ("Örebro University scholarships" -> "Örebro University")
 *   scholarshipType  -> providerType (university / Swedish Institute / other)
 *   officialUrl      -> officialUrl (the provider's scholarship page)
 *   Study in Sweden detail URL -> sourceUrl
 *   regions          -> eligibleNationalities (ISO codes)
 *   countryCode      -> SE
 *
 * All records are destination Sweden. Levels/amounts/deadlines are not
 * published in the guide (they vary per provider), so those stay unset
 * honestly — the description points users to the official page.
 *
 * Usage:
 *   npx tsx scripts/import-studyinsweden.ts --dry-run
 *   npx tsx scripts/import-studyinsweden.ts
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
  for (const line of readFileSync("data/studyinsweden/scholarships.jsonl", "utf8").split("\n")) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line));
  }
  console.log(`Study in Sweden records: ${rows.length}`);

  const usable = rows.filter((r) => r.title && r.officialUrl);
  console.log(`usable (with official URL): ${usable.length}`);

  const existing = await prisma.scholarship.findMany({
    select: { id: true, slug: true, sourceUrl: true, title: true, provider: true, status: true, deadline: true },
  });
  const existingSlugs = new Set(existing.map((r) => r.slug));
  const existingUrls = new Set(existing.map((r) => r.sourceUrl).filter(Boolean) as string[]);
  const existingFp = new Set(
    existing.map((r) => `${(r.title || "").toLowerCase().slice(0, 80)}|${(r.provider || "").toLowerCase().slice(0, 60)}`)
  );
  const existingByUrl = new Map(
    existing.filter((r) => r.sourceUrl).map((r) => [r.sourceUrl as string, r])
  );

  let created = 0;
  let dup = 0;
  let renewed = 0;
  let deadlineUpdated = 0;
  const toCreate: any[] = [];
  const renewals: { id: string; data: any }[] = [];
  const deadlineUpdates: { id: string; deadline: Date }[] = [];
  for (const rec of usable) {
    const title = (rec.title || "").trim();
    const sourceUrlFull = `https://studyinsweden.se/scholarships/${rec.slug}/`;

    const slug = `${slugify(title)}-se`;
    let uniqueSlug = slug;
    let i = 2;
    const inBatch = new Set(toCreate.map((c: any) => c.slug));
    while (existingSlugs.has(uniqueSlug) || inBatch.has(uniqueSlug)) uniqueSlug = `${slug}-${i++}`;

    // Provider from the title ("Örebro University scholarships" -> "Örebro University")
    let provider = "";
    let providerType = "FOUNDATION";
    const type = rec.scholarshipType || "";
    if (/university scholarships/i.test(type)) {
      provider = title.replace(/\s+scholarships?\s*$/i, "").trim();
      providerType = "UNIVERSITY";
    } else if (/swedish institute/i.test(type)) {
      provider = "Swedish Institute";
      providerType = "GOVERNMENT";
    } else {
      provider = title.replace(/\s+scholarships?\s*$/i, "").trim() || "Swedish organisation";
      providerType = "NGO";
    }
    if (!provider) provider = "Swedish organisation";

    const fp = `${title.toLowerCase().slice(0, 80)}|${provider.toLowerCase().slice(0, 60)}`;

    const desc = `${title} — scholarship listed in the official Study in Sweden database (studyinsweden.se), the Swedish government's guide for international students. Destination: Sweden. Verify current value, eligibility, level and deadline on the official provider website before applying.`;

    const row = {
      slug: uniqueSlug,
      title,
      description: desc,
      provider: provider.slice(0, 150),
      providerType,
      countryCode: "SE",
      city: null,
      studyLevels: "[]",
      fields: "[]",
      degrees: "[]",
      eligibleNationalities: JSON.stringify(rec.regions || []),
      fundingType: "PARTIAL",
      benefits: "[]",
      amount: null,
      currency: null,
      duration: null,
      deadline: null,
      deadlineTimezone: null,
      applicationFee: null,
      languageRequirements: "{}",
      academicRequirements: null,
      ageRequirements: null,
      workExperience: null,
      requiredDocuments: "[]",
      applicationSteps: "[]",
      officialUrl: rec.officialUrl,
      sourceUrl: sourceUrlFull,
      recordType: "SCHOLARSHIP",
      verificationStatus: "RECENTLY_UPDATED",
      status: "ACTIVE",
      lastVerifiedAt: new Date(),
      submittedNote: `Imported from the official Study in Sweden database (studyinsweden.se/scholarships).`,
      createdAt: new Date(),
    };

    // Re-crawl of an already-imported record: renew it if it expired and the
    // source still lists it; correct the deadline if it changed mid-cycle.
    const urlMatch = existingByUrl.get(sourceUrlFull);
    if (urlMatch) {
      const decision = renewalDecision(urlMatch, row);
      if (decision.kind === "renew") {
        renewals.push(decision);
        renewed++;
      } else if (decision.kind === "update-deadline") {
        deadlineUpdates.push(decision);
        deadlineUpdated++;
      } else {
        dup++;
      }
      continue;
    }
    if (existingFp.has(fp) || existingSlugs.has(slug)) {
      dup++;
      continue;
    }

    toCreate.push(row);
    created++;
  }

  console.log(`created: ${created}, duplicates skipped: ${dup}, renewed: ${renewed}, deadlines updated: ${deadlineUpdated}`);
  if (DRY_RUN) {
    console.log("dry run — no writes");
    await prisma.$disconnect();
    return;
  }

  const CHUNK = 50;
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    await createManySkipDuplicates(prisma.scholarship, toCreate.slice(i, i + CHUNK), CHUNK);
    console.log(`inserted ${Math.min(i + CHUNK, toCreate.length)}/${toCreate.length}`);
  }

  const { renewed: rn, deadlineUpdated: du } = await applyRenewals(renewals, deadlineUpdates);
  console.log(`renewals applied: ${rn}, deadline updates applied: ${du}`);

  const inserted = await prisma.scholarship.count({
    where: { sourceUrl: { contains: "studyinsweden.se" } },
  });
  console.log(`Total Study in Sweden records in DB: ${inserted}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
