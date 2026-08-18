import { unstable_cache } from "next/cache";

/**
 * Cross-request data cache (Next.js Data Cache / Vercel).
 *
 * The scholarship catalogue only changes on the weekly re-crawl and rare admin
 * edits, so the heavy aggregate reads (country/field counts, university lists,
 * sitemap rows) are cached across requests. This is the main lever against
 * Neon's egress limits: a full-table scan currently runs on *every* page view,
 * and caching it drops the repeated reads to zero within the TTL window.
 *
 * Important: the cached function must return JSON-serializable data (no Date
 * objects — Dates become strings through the cache). Keep the heavy queries
 * to numbers/strings and rehydrate Dates at the call site when needed.
 */
export function cachedData<T>(key: string[], fn: () => Promise<T>, revalidateSeconds: number) {
  return unstable_cache(fn, key, { revalidate: revalidateSeconds });
}

// Catalogue data refreshes weekly — 6h TTL is generous but keeps stale-window
// short enough that countdowns and counts stay honest.
export const CATALOGUE_TTL = 6 * 60 * 60;
// Homepage aggregates (stats strip, country counts) — fresher than the rest so
// the "9,000+ opportunities" numbers never look stale.
export const HOMEPAGE_TTL = 60 * 60;
