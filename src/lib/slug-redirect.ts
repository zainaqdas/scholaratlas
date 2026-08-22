/**
 * Old-slug → new-slug redirect lookup for detail pages.
 *
 * The Neon → Turso migration regenerated every slug (new format appends a
 * provider domain + random suffix), so pre-migration URLs like
 * `/scholarships/knight-hennessy-scholarship` or `/universities/stanford-university`
 * now 404. The map (built by scripts/build-slug-redirect-map.ts, regenerated on
 * every deploy) reconstructs the old slug from each record's title/name and maps
 * it to the current slug.
 *
 * The map is ~2.4 MB, so it is loaded lazily via dynamic import — only when a
 * detail page actually misses its primary lookup. Normal (new-slug) traffic
 * never pays for it.
 */
export interface SlugRedirectMap {
  scholarships: Record<string, string>;
  universities: Record<string, string>;
}

let cached: SlugRedirectMap | null = null;

async function loadMap(): Promise<SlugRedirectMap> {
  if (!cached) {
    cached = (await import("./slug-redirect-map.generated.json")).default as SlugRedirectMap;
  }
  return cached;
}

/** Resolve an old scholarship slug to its current slug, or null. */
export async function resolveScholarshipSlug(oldSlug: string): Promise<string | null> {
  const map = await loadMap();
  return map.scholarships[oldSlug] ?? null;
}

/** Resolve an old university slug to its current slug, or null. */
export async function resolveUniversitySlug(oldSlug: string): Promise<string | null> {
  const map = await loadMap();
  return map.universities[oldSlug] ?? null;
}
