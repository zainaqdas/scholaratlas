// Static-index suggest lookup for the header search box.
//
// The suggest endpoint is hit on EVERY keystroke, and doing %term% LIKE scans
// against Turso per keystroke was the single biggest read consumer in the app
// (4 full-table scans × ~24k rows per unique query string — typing one word
// fires ~8 debounced requests, each a cold compute). With the full catalogue
// generated into a static JSON module at build time (see
// scripts/build-search-index.ts and the `prebuild` hook), this module filters
// in memory: ZERO Turso reads per keystroke.
//
// The index only carries the small fields the dropdown renders — never
// descriptions, deadlines or other heavy columns.

import { FIELDS, FIELD_GROUPS } from "./constants";
import searchIndex from "./search-index.generated.json";

export interface SuggestResult {
  scholarships: { slug: string; title: string; provider: string; country?: { name: string } | null }[];
  universities: { slug: string; name: string }[];
  countries: { code: string; name: string; flag: string | null }[];
  fields: { slug: string; name: string }[];
  articles: { slug: string; title: string; category: string }[];
}

export async function searchSuggestions(q: string, limit = 5): Promise<SuggestResult> {
  const query = q.trim().toLowerCase();
  if (!query) {
    return { scholarships: [], universities: [], countries: [], fields: [], articles: [] };
  }

  // The index is pre-sorted by views (popular first), so a simple filter +
  // slice keeps the same "top suggestions" behaviour the DB query had.
  const scholarships = searchIndex.scholarships
    .filter((s) => s.title.toLowerCase().includes(query) || s.provider.toLowerCase().includes(query))
    .slice(0, limit)
    .map((s) => ({
      slug: s.slug,
      title: s.title,
      provider: s.provider,
      country: s.countryName ? { name: s.countryName } : null,
    }));

  const universities = searchIndex.universities
    .filter((u) => u.name.toLowerCase().includes(query))
    .slice(0, limit);

  const countries = searchIndex.countries
    .filter((c) => c.name.toLowerCase().includes(query))
    .slice(0, limit);

  const articles = searchIndex.articles
    .filter((a) => a.title.toLowerCase().includes(query) || a.category.toLowerCase().includes(query))
    .slice(0, limit);

  // Fields are static — filter client-side data (groups + leaves, so typing
  // "health" surfaces the Medicine & Health category too). Some slugs exist in
  // BOTH lists (e.g. "engineering" is a group AND a leaf field) — dedupe by
  // slug so the dropdown never renders duplicate rows / duplicate React keys.
  const fields = [...FIELD_GROUPS, ...FIELDS]
    .map((f) => ({ slug: f.slug, name: f.name }))
    .filter((f) => f.name.toLowerCase().includes(query))
    .filter((f, i, arr) => arr.findIndex((x) => x.slug === f.slug) === i)
    .slice(0, limit);

  return { scholarships, universities, countries, fields, articles };
}
