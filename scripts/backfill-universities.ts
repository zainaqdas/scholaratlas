import { createManySkipDuplicates } from "./lib/insert-many";
/* eslint-disable no-console */
// ---------------------------------------------------------------------------
// Create University records from scholarship providers and link scholarships.
//
// Sources of truth:
//   - data/wms-university-countries.json — provider -> { slug, country, iso }
//     (authoritative map built during the country backfill, from the live
//     wemakescholars /university/{slug}/scholarships pages + official URLs)
//   - existing University rows (matched by name) are reused, never duplicated.
//
// Only scholarships without a universityId are touched. Providers with no
// country mapping are skipped (left unlinked) — no fabricated locations.
//
// Usage:
//   npm run backfill:universities                 # apply
//   npm run backfill:universities -- --dry-run    # report only
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function norm(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ").trim();
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const COLORS = ["#6B21A8", "#BE185D", "#B91C1C", "#C2410C", "#A16207", "#15803D", "#0E7490", "#1D4ED8"];

async function main() {
  // 1. Load the provider -> country map.
  let map: Record<string, { provider: string; slug: string; country: string; iso: string }> = {};
  try {
    map = JSON.parse(readFileSync("data/wms-university-countries.json", "utf-8"));
  } catch {
    console.error("Could not read data/wms-university-countries.json — aborting.");
    process.exit(1);
  }
  const byNorm = new Map<string, (typeof map)[string]>();
  for (const v of Object.values(map)) byNorm.set(norm(v.provider), v);
  console.log(`Provider->country map: ${byNorm.size} providers.`);

  // 2. Unique providers of unlinked scholarships.
  const rows = await prisma.$queryRawUnsafe<{ provider: string }[]>(`
    SELECT DISTINCT provider FROM "Scholarship" WHERE "universityId" IS NULL
  `);
  console.log(`Unique unlinked providers: ${rows.length}`);

  // 3. Existing universities (reuse by name).
  const existing = await prisma.university.findMany({ select: { id: true, name: true, slug: true } });
  const uniByName = new Map(existing.map((u) => [norm(u.name), u]));
  const uniBySlug = new Map(existing.map((u) => [u.slug, u]));
  console.log(`Existing universities: ${existing.length}`);

  // 4. Decide which providers get a University record.
  const toCreate = new Map<string, { name: string; slug: string; countryCode: string }>();
  const matchedById = new Map<string, string>(); // providerName -> universityId
  const unmatched: string[] = [];

  // For providers not in the map, fall back to the majority countryCode of
  // their own scholarships IF the provider name clearly identifies a
  // university (destination country == host country for university
  // scholarships). Non-university orgs (foundations, governments, NGOs) are
  // left unlinked — they don't belong in the Universities explorer.
  const provCountries = new Map<string, Map<string, number>>();
  const uniLike = /university|college|institute|school|academy|polytechnic|technological/i;
  // Count REAL records per (provider, country) so majority voting is accurate.
  const provRows = await prisma.$queryRawUnsafe<{ provider: string; countryCode: string | null; c: number }[]>(`
    SELECT provider, "countryCode", COUNT(*)::int AS c
    FROM "Scholarship" WHERE "universityId" IS NULL GROUP BY provider, "countryCode"
  `);
  for (const r of provRows) {
    if (!r.countryCode) continue;
    if (!provCountries.has(r.provider)) provCountries.set(r.provider, new Map());
    provCountries.get(r.provider)!.set(r.countryCode, (provCountries.get(r.provider)!.get(r.countryCode) ?? 0) + r.c);
  }

  for (const { provider } of rows) {
    const existingUni = uniByName.get(norm(provider));
    if (existingUni) {
      matchedById.set(provider, existingUni.id);
      continue;
    }
    const mapped = byNorm.get(norm(provider));
    const iso = mapped?.iso;
    if (iso) {
      let slug = mapped.slug || slugify(provider);
      while (uniBySlug.has(slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      uniBySlug.set(slug, { id: "" } as never);
      toCreate.set(provider, { name: provider, slug, countryCode: iso });
      continue;
    }
    // Fallback: university-like provider with a majority scholarship country.
    const cc = provCountries.get(provider);
    if (uniLike.test(provider) && cc && cc.size > 0) {
      const majority = [...cc.entries()].sort((a, b) => b[1] - a[1])[0][0];
      let slug = slugify(provider);
      while (uniBySlug.has(slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      uniBySlug.set(slug, { id: "" } as never);
      toCreate.set(provider, { name: provider, slug, countryCode: majority });
      continue;
    }
    unmatched.push(provider);
  }

  console.log(`Providers to create University for: ${toCreate.size}`);
  console.log(`Providers reusing existing University: ${matchedById.size}`);
  console.log(`Providers left unlinked (no country / non-university): ${unmatched.length}`);
  for (const u of unmatched.slice(0, 20)) console.log(`  - ${u}`);

  if (DRY_RUN) {
    console.log(`[dry-run] would create ${toCreate.size} universities, link ${rows.length - unmatched.length} providers.`);
    return;
  }

  // 5. Create universities.
  let uniCreated = 0;
  if (toCreate.size) {
    const data = [...toCreate.values()].map((u) => ({
      slug: u.slug,
      name: u.name,
      countryCode: u.countryCode,
      logoText: initialsOf(u.name),
      color: COLORS[u.name.length % COLORS.length],
    }));
    // filter to countries that exist
    const countries = await prisma.country.findMany({ select: { code: true } });
    const validCodes = new Set(countries.map((c) => c.code));
    const valid = data.filter((d) => validCodes.has(d.countryCode));
    console.log(`Valid country codes: ${valid.length}/${data.length}`);
    uniCreated = await createManySkipDuplicates(prisma.university, valid);
    const created = await prisma.university.findMany({ where: { slug: { in: valid.map((u) => u.slug) } } });
    for (const u of created) {
      const key = norm(u.name);
      if (!uniByName.has(key)) uniByName.set(key, u);
    }
  }

  // 6. Link scholarships: provider -> universityId.
  const idByProvider = new Map<string, string>();
  for (const [provider] of toCreate) {
    const u = uniByName.get(norm(provider));
    if (u) idByProvider.set(provider, u.id);
  }
  for (const [provider, id] of matchedById) idByProvider.set(provider, id);
  console.log(`Providers linkable: ${idByProvider.size}`);

  let linked = 0;
  const BATCH = 400;
  for (const [provider, uniId] of idByProvider) {
    const recs = await prisma.scholarship.findMany({
      where: { provider, universityId: null },
      select: { id: true },
    });
    for (let i = 0; i < recs.length; i += BATCH) {
      const batch = recs.slice(i, i + BATCH);
      await prisma.$transaction(
        batch.map((r) =>
          prisma.scholarship.update({ where: { id: r.id }, data: { universityId: uniId, updatedAt: new Date() } }),
        ),
      );
    }
    linked += recs.length;
    if (linked % 1000 < 400) console.log(`Linked ${linked}...`);
  }
  console.log(`Done: created ${uniCreated} universities, linked ${linked} scholarships.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
