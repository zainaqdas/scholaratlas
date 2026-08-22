/**
 * build-slug-redirect-map.ts
 *
 * Generates the old-slug → new-slug redirect map used by the scholarship and
 * university detail pages.
 *
 * Background: the Neon → Turso migration regenerated every slug. Old slugs
 * were pure title/name based (e.g. `/scholarships/knight-hennessy-scholarship`
 * or `/universities/stanford-university`); new slugs append a provider domain
 * and a random suffix (e.g. `stanford-university-7rx4o`), so every old
 * bookmarked / Google-indexed URL returns 404. There is no old-DB dump, but
 * the old slug was a deterministic function of the record's title/name, which
 * is unchanged for the vast majority of records — so we reconstruct it:
 *
 *   Scholarship: title.toLowerCase().replace(/[^a-z0-9]+/g,"-")...slice(0,120)
 *   University:  name.toLowerCase(), & → "and", [^a-z0-9]+ → "-", trim/collapse
 *
 * Output (`src/lib/slug-redirect-map.generated.json`):
 *   { "scholarships": { oldSlug: newSlug, ... }, "universities": { ... } }
 *
 * Rules:
 *   - Entries where oldSlug === newSlug are skipped (no redirect needed).
 *   - Entries whose oldSlug is ALREADY a live slug of a different record are
 *     skipped (that URL already resolves; a redirect would hijack it).
 *   - If several records reconstruct to the same old slug (title collisions),
 *     the ACTIVE one with the most views wins, mirroring the old unique-slug
 *     constraint.
 *
 * The file is committed (so local dev and deploys work without a DB) and
 * regenerated on every deploy via the `prebuild` hook, tracking the weekly
 * re-crawl automatically.
 *
 * Run manually:
 *   npm run build:slug-redirect-map
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";

// Exact old scholarship slug formula (pre-migration sync script).
function oldScholarshipSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

// Exact old university slug formula (pre-migration backfill script).
function oldUniversitySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function main() {
  const [scholarships, universities] = await Promise.all([
    prisma.scholarship.findMany({
      select: { slug: true, title: true, status: true, views: true },
    }),
    prisma.university.findMany({
      select: { slug: true, name: true },
    }),
  ]);

  const liveScholarshipSlugs = new Set(scholarships.map((s) => s.slug));
  const liveUniversitySlugs = new Set(universities.map((u) => u.slug));

  // oldSlug -> best record (ACTIVE + most views wins on collision)
  const bestScholarship = new Map<string, (typeof scholarships)[number]>();
  for (const s of scholarships) {
    const old = oldScholarshipSlug(s.title);
    if (old === s.slug) continue;
    const cur = bestScholarship.get(old);
    if (!cur) {
      bestScholarship.set(old, s);
      continue;
    }
    const curRank = (cur.status === "ACTIVE" ? 1 : 0) * 1_000_000_000 + cur.views;
    const sRank = (s.status === "ACTIVE" ? 1 : 0) * 1_000_000_000 + s.views;
    if (sRank > curRank) bestScholarship.set(old, s);
  }

  const bestUniversity = new Map<string, (typeof universities)[number]>();
  for (const u of universities) {
    const old = oldUniversitySlug(u.name);
    if (old === u.slug) continue;
    if (!bestUniversity.has(old)) bestUniversity.set(old, u);
  }

  const scholarshipMap: Record<string, string> = {};
  let skips = 0;
  for (const [old, rec] of bestScholarship) {
    // Never hijack a URL that already resolves to a live record.
    if (liveScholarshipSlugs.has(old)) {
      skips++;
      continue;
    }
    scholarshipMap[old] = rec.slug;
  }

  const universityMap: Record<string, string> = {};
  for (const [old, rec] of bestUniversity) {
    if (liveUniversitySlugs.has(old)) {
      skips++;
      continue;
    }
    universityMap[old] = rec.slug;
  }

  const outPath = join(process.cwd(), "src/lib/slug-redirect-map.generated.json");
  writeFileSync(outPath, JSON.stringify({ scholarships: scholarshipMap, universities: universityMap }));
  console.log(
    `Slug redirect map written to ${outPath}: ${Object.keys(scholarshipMap).length} scholarships, ` +
      `${Object.keys(universityMap).length} universities (${skips} shadowed old slugs skipped)`
  );
}

main()
  .catch((err) => {
    // Fail soft: keep any previously generated map so a transient DB issue
    // during a deploy never breaks old-URL redirects. The committed map is
    // the fallback for local dev.
    console.warn("build-slug-redirect-map: could not regenerate map, keeping existing file:", err);
  })
  .finally(() => prisma.$disconnect());
