// Scholarship search. Filters are applied in the database (Prisma), while
// relevance ranking and pagination are computed in memory — appropriate for
// the current dataset size. Production note: when moving to large-scale
// PostgreSQL, move ranking to pg_trgm / full-text and pagination to SQL.

import { createHash } from "crypto";
import { Prisma, type Scholarship } from "@prisma/client";
import { prisma } from "./prisma";
import { SCHOLARSHIPS_PER_PAGE, fieldSlugsForFilter, studyLevelFromSlug } from "./constants";
import { daysUntil } from "./format";
import { withOpenDeadline } from "./scholarship";

/**
 * The cache key for a filter set. Date windows are normalized out of the key
 * (the open-deadline filter embeds a fresh `new Date()` per request) so that
 * a filter set always maps to the same cache entry.
 *
 * NOTE: the Date must be replaced BEFORE JSON.stringify — JSON.stringify runs
 * Date.prototype.toJSON (producing an ISO string with millisecond precision)
 * before the replacer sees the value, so a replacer-based approach silently
 * embeds a fresh timestamp in the key and the cache misses on every request.
 */
function whereCacheKey(where: Prisma.ScholarshipWhereInput): string {
  const normalize = (v: unknown): unknown => {
    if (v instanceof Date) return "__NOW__";
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) out[k] = normalize(val);
      return out;
    }
    return v;
  };
  const json = JSON.stringify(normalize(where));
  return createHash("sha1").update(json).digest("hex").slice(0, 20);
}

// --- DB-backed cache (Turso) -------------------------------------------------
// Next 16's unstable_cache does NOT persist across requests in dynamic routes
// on Vercel — verified empirically: 60 warm list requests each re-ran the full
// 8.7k-row plan (17,441 row-reads apiece) because the data cache was never
// hit. So the sorted-ID plans and suggest results live in a tiny Turso table
// instead: one primary-key lookup (~2 row-reads) per request, recomputed at
// most once per TTL per key. The catalogue only changes when deadlines pass or
// the weekly re-crawl lands, so these TTLs are invisible in practice.

const PLAN_TTL_MS = 6 * 60 * 60 * 1000; // list pages: deadlines are the only drift
const SEARCH_TTL_MS = 5 * 60 * 1000; // ranked search plans (funding / relevance)
const SUGGEST_TTL_MS = 60 * 1000; // per-keystroke suggestions

async function dbCached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const rows = await prisma.$queryRaw<{ valueJson: string }[]>`
    SELECT valueJson FROM QueryPlanCache WHERE key = ${key} AND expiresAt > ${Date.now()} LIMIT 1
  `;
  if (rows.length > 0) {
    return JSON.parse(rows[0].valueJson) as T;
  }
  const value = await compute();
  const expiresAt = Date.now() + ttlMs;
  await prisma.$executeRaw`
    INSERT INTO QueryPlanCache (key, valueJson, expiresAt)
    VALUES (${key}, ${JSON.stringify(value)}, ${expiresAt})
    ON CONFLICT(key) DO UPDATE SET valueJson = excluded.valueJson, expiresAt = excluded.expiresAt
  `;
  // Occasional sweep of expired rows keeps the table tiny (a few hundred keys).
  if (Math.random() < 0.02) {
    await prisma.$executeRaw`DELETE FROM QueryPlanCache WHERE expiresAt < ${Date.now()}`;
  }
  return value;
}

interface ListPlan {
  ids: string[];
  total: number;
}

/**
 * The sorted ID list + total for a filter set — the "fetch once, serve
 * everyone" behaviour: the whole filtered set is read and sorted at most once
 * per PLAN_TTL_MS per filter set (~8.7k row reads, no joins), then every
 * request — any page number, any user, any crawler — is served from the cache
 * and only fetches its own page of rows by primary key. Pagination is free:
 * page numbers are not part of the key, so all pagination URLs for a filter
 * set share one cached plan.
 */
function cachedListPlan(
  where: Prisma.ScholarshipWhereInput,
  orderBy: Prisma.ScholarshipOrderByWithRelationInput[]
): Promise<ListPlan> {
  const key = `${whereCacheKey(where)}-${orderBy.map((o) => JSON.stringify(o)).join("|")}`;
  return dbCached(
    `list-plan-${createHash("sha1").update(key).digest("hex").slice(0, 24)}`,
    PLAN_TTL_MS,
    async () => {
      const rows = await prisma.scholarship.findMany({
        where,
        select: { id: true },
        orderBy,
      });
      return { ids: rows.map((r) => r.id), total: rows.length };
    }
  );
}

/** Fetch one page of rows by primary key, preserving the plan's sort order. */
async function fetchPageByIds(ids: string[], page: number): Promise<Scholarship[]> {
  const start = (page - 1) * SCHOLARSHIPS_PER_PAGE;
  const slice = ids.slice(start, start + SCHOLARSHIPS_PER_PAGE);
  if (slice.length === 0) return [];
  const rows = await prisma.scholarship.findMany({
    where: { id: { in: slice } },
    include: { university: true, country: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: (typeof rows)[number][] = [];
  for (const id of slice) {
    const r = byId.get(id);
    if (r) out.push(r);
  }
  return out;
}

export type SortKey = "relevance" | "deadline" | "recent" | "funding" | "popular";

export interface SearchFilters {
  q?: string;
  levels?: string[]; // study level slugs
  funding?: string[]; // FundingType values
  countries?: string[]; // destination country codes
  nationality?: string; // applicant country code or "international"
  field?: string; // field slug
  deadline?: string; // DeadlineWindow
  providers?: string[]; // ProviderType values
  languages?: string[]; // language filter slugs
  fee?: string; // "free" | "required"
  verifiedOnly?: boolean; // only records checked against an official source
  featuredOnly?: boolean;
  recordType?: "SCHOLARSHIP" | "JOB" | "CONTEST" | "ALL"; // default SCHOLARSHIP (jobs/contests excluded from the catalogue)
  sort?: SortKey;
  page?: number;
  status?: string; // default ACTIVE
}

export interface SearchResult {
  items: Scholarship[];
  total: number;
  page: number;
  pageCount: number;
}

const MIN_DATE = new Date(0);

function deadlineWindowRange(deadline: string): { gte?: Date; lte?: Date } | null {
  const now = new Date();
  const addDays = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
  switch (deadline) {
    case "this-week":
      return { gte: now, lte: addDays(7) };
    case "closing-soon":
      return { gte: now, lte: addDays(14) };
    case "this-month":
      return { gte: now, lte: addDays(30) };
    case "next-3-months":
      return { gte: now, lte: addDays(90) };
    case "open":
      // No deadline at all
      return { lte: MIN_DATE };
    case "upcoming":
      // Deadline beyond the next 3 months
      return { gte: addDays(90) };
    default:
      return null;
  }
}

export async function searchScholarships(filters: SearchFilters = {}): Promise<SearchResult> {
  let where: Prisma.ScholarshipWhereInput = {
    // status defaults to ACTIVE (open opportunities); "ALL" includes expired
    // records kept for history/SEO. PENDING/ARCHIVED are never shown publicly.
    status:
      filters.status === "ALL"
        ? { in: ["ACTIVE", "EXPIRED"] }
        : (filters.status ?? "ACTIVE"),
    // The catalogue is scholarships only; research/PhD job listings (e.g.
    // EURAXESS) are a separate record type and excluded by default.
    recordType: filters.recordType === "ALL" ? undefined : (filters.recordType ?? "SCHOLARSHIP"),
  };

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    // SQLite LIKE is case-insensitive for ASCII by default, so lowercase
    // "gynecology" matches "Gynecology — Shandong University" without a mode flag.
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
      { provider: { contains: q } },
    ];
  }

  if (filters.levels?.length) {
    // A record matches when it contains ANY of the selected study levels —
    // selecting "Undergraduate + Master's" must return both, not only records
    // that happen to carry every level (which is almost none). All branches
    // sit inside a single OR so each level matches independently.
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      { OR: filters.levels.map((l) => ({ studyLevels: { contains: l } })) },
    ];
  }

  if (filters.funding?.length) {
    where.fundingType = { in: filters.funding };
  }

  if (filters.countries?.length) {
    const codes = filters.countries.map((c) => c.toUpperCase());
    const hasGlobal = codes.includes("GLOBAL");
    const specific = codes.filter((c) => c !== "GLOBAL");
    // Multi-country programmes (SEARCA, Erasmus Mundus, VLIR-UOS…) store their
    // host list in hostCountries (JSON country-code array). A destination filter
    // matches a record by its single countryCode OR by appearing in its
    // hostCountries list. Quoted containment keeps "TH" from matching inside a
    // longer code — codes are stored as JSON strings, so "\"PH\"" is exact.
    const hostMatch = (code: string) => ({ hostCountries: { contains: `"${code}"` } });
    if (hasGlobal && specific.length === 0) {
      // "Global / Multiple Countries" — no single host country (Erasmus Mundus,
      // VLIR-UOS, online programmes…). Pinning one country would be wrong.
      where.countryCode = null;
    } else if (hasGlobal) {
      // Global OR any of the selected countries (incl. multi-country host lists)
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        { OR: [{ countryCode: null }, { countryCode: { in: specific } }, ...specific.map(hostMatch)] },
      ];
    } else {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        { OR: [{ countryCode: { in: specific } }, ...specific.map(hostMatch)] },
      ];
    }
  }

  if (filters.field) {
    // Fields is a JSON array string. A group slug (e.g. "medicine-health")
    // matches every child field slug; a leaf slug matches only itself.
    // Open-to-all records ("ALL" marker) match any field. Slugs are matched in
    // quoted form so "media" never matches "multimedia" and "sciences" never
    // matches "natural-sciences". All branches sit inside a single OR (a
    // top-level `fields` filter would be ANDed with it and cancel the match).
    const slugs = fieldSlugsForFilter(filters.field);
    if (slugs) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            ...slugs.map((s) => ({ fields: { contains: `"${s}"` } })),
            { fields: { contains: '"ALL"' } },
          ],
        },
      ];
    } else {
      // Unknown field slug — match nothing so the empty state shows instead of
      // silently returning every record (which would imply they're all in the
      // requested field). An impossible filter is more honest than no filter.
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        { fields: { contains: "__no_such_field__" } },
      ];
    }
  }

  if (filters.nationality) {
    const code = filters.nationality.toUpperCase();
    // Open-to-all ("ALL") scholarships match any nationality, so both branches
    // must sit inside a single OR (a top-level filter would be ANDed and cancel).
    if (code === "INTERNATIONAL") {
      where.eligibleNationalities = { contains: '"ALL"' };
    } else {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { eligibleNationalities: { contains: code } },
            { eligibleNationalities: { contains: '"ALL"' } },
          ],
        },
      ];
    }
  }

  if (filters.providers?.length) {
    where.providerType = { in: filters.providers };
  }

  if (filters.deadline) {
    const range = deadlineWindowRange(filters.deadline);
    if (range) {
      if (filters.deadline === "open") {
        where.deadline = null;
      } else {
        where.deadline = { gte: range.gte, lte: range.lte };
      }
    }
  }

  if (filters.fee === "free") {
    // Free = explicitly "Free"/"free" OR unspecified (null, free by default).
    // Both branches must sit inside a single OR (a top-level applicationFee
    // filter would be ANDed with it and cancel the null branch).
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [{ applicationFee: null }, { applicationFee: { in: ["Free", "free"] } }],
      },
    ];
  } else if (filters.fee === "required") {
    where.applicationFee = { notIn: ["Free", "free"], not: null };
  }

  if (filters.languages?.length) {
    const langWheres: Prisma.ScholarshipWhereInput[] = [];
    for (const lang of filters.languages) {
      if (lang === "no-ielts" || lang === "not-required") {
        // languageRequirements JSON contains noIels/notRequired/altProof true
        langWheres.push({
          OR: [
            { languageRequirements: { contains: '"noIelts":true' } },
            { languageRequirements: { contains: '"notRequired":true' } },
            { languageRequirements: { contains: '"altProof":true' } },
          ],
        });
      } else if (lang === "ielts") {
        langWheres.push({ languageRequirements: { contains: '"ielts":true' } });
      } else if (lang === "toefl") {
        langWheres.push({ languageRequirements: { contains: '"toefl":true' } });
      } else if (lang === "alt-proof") {
        langWheres.push({ languageRequirements: { contains: '"altProof":true' } });
      }
    }
    if (langWheres.length) {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { OR: langWheres }];
    }
  }

  if (filters.verifiedOnly) {
    // Only records whose data was checked against an official source
    // (Campus Bourses, DAAD, Study in Sweden, uni-direct, CampusChina).
    where.verificationStatus = "VERIFIED";
  }

  if (filters.featuredOnly) {
    where.isFeatured = true;
  }

  // Self-maintaining expiry: the default open view (status ACTIVE, no explicit
  // deadline window) also excludes records whose deadline has already passed,
  // so search never shows a closed opportunity as open. Records without a
  // deadline are treated as open. Skipped when the user picked a deadline
  // window (that choice already expresses intent) or requested ALL statuses.
  const statusActive = !filters.status || filters.status === "ACTIVE";
  if (statusActive && !filters.deadline) {
    where = withOpenDeadline(where);
  }

  const q = filters.q?.trim().toLowerCase();
  const sort = filters.sort ?? "relevance";
  const page = Math.max(1, filters.page ?? 1);

  // Sorts that can be pushed into SQL (the overwhelming majority of traffic:
  // default/filtered views hit repeatedly by crawlers). Only relevance-with-a
  // query and the funding ranking need the full result set in memory — those
  // are user-initiated, so volume is low.
  const needsInMemorySort = sort === "funding" || (sort === "relevance" && !!q);

  if (!needsInMemorySort) {
    const orderBy: Prisma.ScholarshipOrderByWithRelationInput[] =
      sort === "deadline"
        ? [{ deadline: { sort: "asc", nulls: "last" } }]
        : sort === "recent"
          ? [{ createdAt: "desc" }]
          : [{ views: "desc" }, { createdAt: "desc" }];

    // The sorted ID list + total come from the cache (recomputed at most once
    // per PLAN_TTL_MS per filter set); only the current page's 12 rows are
    // fetched from Turso, by primary key (~36 row reads).
    const plan = await cachedListPlan(where, orderBy);
    const itemsPage = await fetchPageByIds(plan.ids, page);

    return {
      items: itemsPage,
      total: plan.total,
      page,
      pageCount: Math.max(1, Math.ceil(plan.total / SCHOLARSHIPS_PER_PAGE)),
    };
  }

  // --- in-memory ranking (relevance with a query / funding sort) ------------
  // User-initiated and low-volume, but a paginated search result would re-read
  // every matching row per page — so the ranked ID plan is cached too (5 min).
  const plan = await dbCached(
    `search-plan-${whereCacheKey(where)}-${sort === "funding" ? "funding" : `relevance-${q}`}`,
    SEARCH_TTL_MS,
    async () => {
      const rows = await prisma.scholarship.findMany({
        where,
        select: { id: true, fundingType: true, title: true, views: true },
      });
      let sorted = rows;
      if (sort === "funding") {
        const rank = (f: string) =>
          f === "FULLY_FUNDED" ? 0 : f === "FULLY_FUNDED_STIPEND" ? 1 : f === "TUITION_WAIVER" ? 2 : 3;
        sorted = [...rows].sort((a, b) => rank(a.fundingType) - rank(b.fundingType));
      } else if (q) {
        // relevance: exact title hits first, then recency
        sorted = [...rows].sort((a, b) => {
          const at = a.title.toLowerCase().includes(q) ? 0 : 1;
          const bt = b.title.toLowerCase().includes(q) ? 0 : 1;
          if (at !== bt) return at - bt;
          return b.views - a.views;
        });
      }
      return { ids: sorted.map((r) => r.id), total: sorted.length };
    }
  );
  const itemsPage = await fetchPageByIds(plan.ids, page);

  return {
    items: itemsPage,
    total: plan.total,
    page,
    pageCount: Math.max(1, Math.ceil(plan.total / SCHOLARSHIPS_PER_PAGE)),
  };
}

// Lightweight suggestion lookup used by the search box. Every keystroke fires
// a request here, and %term% LIKE scans read the full table (~25k rows × 4
// tables) — so results are cached for 60s per query string (DB-backed; see
// dbCached above).
export async function searchSuggestions(q: string, limit = 5) {
  const query = q.trim().toLowerCase();
  if (!query) {
    return { scholarships: [], universities: [], countries: [], fields: [], articles: [] };
  }
  return dbCached(
    `suggest-${createHash("sha1").update(query).digest("hex").slice(0, 12)}-${limit}`,
    SUGGEST_TTL_MS,
    async () => {
      const [scholarships, universities, countries, articles] = await Promise.all([
        prisma.scholarship.findMany({
          where: {
            status: "ACTIVE",
            recordType: "SCHOLARSHIP", // never suggest JOB listings (EURAXESS positions)
            OR: [
              { title: { contains: query } },
              { provider: { contains: query } },
            ],
          },
          include: { country: true },
          take: limit,
          orderBy: { views: "desc" },
        }),
        prisma.university.findMany({
          where: { name: { contains: query } },
          include: { country: true },
          take: limit,
        }),
        prisma.country.findMany({
          where: { name: { contains: query } },
          take: limit,
        }),
        prisma.article.findMany({
          where: {
            OR: [
              { title: { contains: query } },
              { category: { contains: query } },
            ],
          },
          take: limit,
        }),
      ]);

      // Fields are static — filter client-side data (groups + leaves, so typing
      // "health" surfaces the Medicine & Health category too)
      const { FIELDS, FIELD_GROUPS } = await import("./constants");
      const fields = [...FIELD_GROUPS, ...FIELDS]
        .map((f) => ({ slug: f.slug, name: f.name }))
        .filter((f) => f.name.toLowerCase().includes(query))
        .slice(0, limit);

      return { scholarships, universities, countries, fields, articles };
    }
  );
}

// Convenience for building URL query strings from filters (shareable filters).
export function buildSearchUrl(filters: SearchFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.levels?.length) params.set("level", filters.levels.join(","));
  if (filters.funding?.length) params.set("funding", filters.funding.join(","));
  if (filters.countries?.length) params.set("country", filters.countries.join(","));
  if (filters.nationality) params.set("nationality", filters.nationality);
  if (filters.field) params.set("field", filters.field);
  if (filters.deadline) params.set("deadline", filters.deadline);
  if (filters.providers?.length) params.set("provider", filters.providers.join(","));
  if (filters.languages?.length) params.set("language", filters.languages.join(","));
  if (filters.fee) params.set("fee", filters.fee);
  if (filters.verifiedOnly) params.set("verified", "true");
  if (filters.featuredOnly) params.set("featured", "1");
  if (filters.status && filters.status !== "ACTIVE") params.set("status", filters.status);
  if (filters.sort && filters.sort !== "relevance") params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const s = params.toString();
  return s ? `/scholarships?${s}` : "/scholarships";
}

// Helpers to read filters from URL search params (App Router).
export function parseFiltersFromUrl(searchParams: URLSearchParams): SearchFilters {
  const toArray = (v: string | null) => (v ? v.split(",").filter(Boolean) : undefined);
  return {
    q: searchParams.get("q") ?? undefined,
    levels: toArray(searchParams.get("level")),
    funding: toArray(searchParams.get("funding")),
    countries: toArray(searchParams.get("country")),
    nationality: searchParams.get("nationality") ?? undefined,
    field: searchParams.get("field") ?? undefined,
    deadline: searchParams.get("deadline") ?? undefined,
    providers: toArray(searchParams.get("provider")),
    languages: toArray(searchParams.get("language")),
    fee: searchParams.get("fee") ?? undefined,
    verifiedOnly: searchParams.get("verified") === "true",
    featuredOnly: searchParams.get("featured") === "1",
    status: (searchParams.get("status") ?? undefined)?.toUpperCase(),
    sort: (searchParams.get("sort") as SortKey) ?? undefined,
    page: Number(searchParams.get("page")) || undefined,
  };
}

export function validLevelSlugs(): string[] {
  // slug -> level slug mapping used by filter UI
  return ["high-school", "undergraduate", "masters", "mba", "phd", "postdoctoral", "research", "short-course", "exchange-program"];
}

export function normalizeLevelSlug(input: string): string {
  const level = studyLevelFromSlug(input);
  if (level) return input;
  // accept common aliases
  const map: Record<string, string> = {
    "master": "masters",
    "ms": "masters",
    "bachelors": "undergraduate",
    "bachelor": "undergraduate",
    "bsc": "undergraduate",
    "post-doc": "postdoctoral",
    "postdoc": "postdoctoral",
    "exchange": "exchange-program",
    "shortcourse": "short-course",
  };
  return map[input.toLowerCase()] ?? input;
}

export { daysUntil };
