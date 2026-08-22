/**
 * build-search-index.ts
 *
 * Generates the static search index used by the header search box's
 * autocomplete (/api/suggest). The suggest endpoint is hit on every keystroke,
 * and doing LIKE scans against Turso per keystroke was the #1 read consumer
 * (4 full-table scans × ~24k rows per unique query string — typing one word
 * fires ~8 debounced requests). With the index generated here, the endpoint
 * filters in memory: ZERO Turso reads per keystroke.
 *
 * The index only contains the small fields the dropdown renders
 * (slug/title/provider/country for scholarships, slug/name for universities,
 * code/name/flag for countries, slug/title/category for articles). It is
 * regenerated on every deploy via the `prebuild` hook, so it tracks the
 * weekly re-crawl automatically.
 *
 * Run manually:
 *   npm run build:search-index
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";

async function main() {
  const [scholarships, universities, countries, articles] = await Promise.all([
    prisma.scholarship.findMany({
      where: { status: "ACTIVE", recordType: "SCHOLARSHIP" },
      select: {
        slug: true,
        title: true,
        provider: true,
        views: true,
        country: { select: { name: true } },
      },
    }),
    prisma.university.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.country.findMany({
      select: { code: true, name: true, flag: true },
      orderBy: { name: "asc" },
    }),
    prisma.article.findMany({
      select: { slug: true, title: true, category: true },
    }),
  ]);

  const index = {
    scholarships: scholarships
      .map((s) => ({
        slug: s.slug,
        title: s.title,
        provider: s.provider,
        views: s.views,
        countryName: s.country?.name ?? null,
      }))
      .sort((a, b) => b.views - a.views),
    universities: universities.map((u) => ({ slug: u.slug, name: u.name })),
    countries: countries.map((c) => ({ code: c.code, name: c.name, flag: c.flag })),
    articles: articles.map((a) => ({ slug: a.slug, title: a.title, category: a.category })),
  };

  const outPath = join(process.cwd(), "src/lib/search-index.generated.json");
  writeFileSync(outPath, JSON.stringify(index));
  console.log(
    `Search index written to ${outPath}: ${index.scholarships.length} scholarships, ` +
      `${index.universities.length} universities, ${index.countries.length} countries, ` +
      `${index.articles.length} articles`
  );
}

main()
  .catch((err) => {
    // Fail soft: keep any previously generated index so a transient DB issue
    // during a deploy never takes the search box down. The committed index is
    // the fallback for local dev.
    console.warn("build-search-index: could not regenerate index, keeping existing file:", err);
  })
  .finally(() => prisma.$disconnect());
