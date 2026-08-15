// Scholarship search. Filters are applied in the database (Prisma), while
// relevance ranking and pagination are computed in memory — appropriate for
// the current dataset size. Production note: when moving to large-scale
// PostgreSQL, move ranking to pg_trgm / full-text and pagination to SQL.

import { Prisma, type Scholarship } from "@prisma/client";
import { prisma } from "./prisma";
import { SCHOLARSHIPS_PER_PAGE, studyLevelFromSlug } from "./constants";
import { daysUntil } from "./format";

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
  featuredOnly?: boolean;
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
const MAX_DATE = new Date(8640000000000000);

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
  const where: Prisma.ScholarshipWhereInput = {
    status: filters.status ?? "ACTIVE",
  };

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
      { provider: { contains: q } },
    ];
  }

  if (filters.levels?.length) {
    where.studyLevels = { contains: filters.levels[0] };
    // handle multiple levels with AND on raw JSON string via array of contains
    if (filters.levels.length > 1) {
      where.AND = [
        { studyLevels: { contains: filters.levels[0] } },
        ...filters.levels.slice(1).map((l) => ({ studyLevels: { contains: l } })),
      ];
    }
  }

  if (filters.funding?.length) {
    where.fundingType = { in: filters.funding };
  }

  if (filters.countries?.length) {
    where.countryCode = { in: filters.countries.map((c) => c.toUpperCase()) };
  }

  if (filters.field) {
    // Fields is a JSON array string; match the slug or the "ALL" marker.
    // Both branches must sit inside a single OR (a top-level `fields` filter
    // would be ANDed with it and cancel the match).
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [{ fields: { contains: filters.field } }, { fields: { contains: '"ALL"' } }],
      },
    ];
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
    where.applicationFee = { in: ["Free", "free"] };
    // also matches null application fees (free by default)
    where.OR = [...(Array.isArray(where.OR) ? where.OR : where.OR ? [where.OR] : []), { applicationFee: null }];
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

  if (filters.featuredOnly) {
    where.isFeatured = true;
  }

  const items = await prisma.scholarship.findMany({
    where,
    include: { university: true, country: true },
  });

  // Relevance ranking
  let sorted = items;
  const q = filters.q?.trim().toLowerCase();
  const sort = filters.sort ?? "relevance";

  if (sort === "deadline") {
    sorted = [...items].sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.getTime() - b.deadline.getTime();
    });
  } else if (sort === "recent") {
    sorted = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } else if (sort === "funding") {
    const rank = (f: string) =>
      f === "FULLY_FUNDED" ? 0 : f === "FULLY_FUNDED_STIPEND" ? 1 : f === "TUITION_WAIVER" ? 2 : 3;
    sorted = [...items].sort((a, b) => rank(a.fundingType) - rank(b.fundingType));
  } else if (sort === "popular") {
    sorted = [...items].sort((a, b) => b.views - a.views);
  } else if (q) {
    // relevance: exact title hits first, then recency
    sorted = [...items].sort((a, b) => {
      const at = a.title.toLowerCase().includes(q) ? 0 : 1;
      const bt = b.title.toLowerCase().includes(q) ? 0 : 1;
      if (at !== bt) return at - bt;
      return b.views - a.views;
    });
  } else {
    sorted = [...items].sort((a, b) => b.views - a.views);
  }

  const total = sorted.length;
  const page = Math.max(1, filters.page ?? 1);
  const pageCount = Math.max(1, Math.ceil(total / SCHOLARSHIPS_PER_PAGE));
  const start = (page - 1) * SCHOLARSHIPS_PER_PAGE;
  const itemsPage = sorted.slice(start, start + SCHOLARSHIPS_PER_PAGE);

  return { items: itemsPage, total, page, pageCount };
}

// Lightweight suggestion lookup used by the search box.
export async function searchSuggestions(q: string, limit = 5) {
  const query = q.trim();
  if (!query) return { scholarships: [], universities: [], countries: [], fields: [], articles: [] };

  const [scholarships, universities, countries, articles] = await Promise.all([
    prisma.scholarship.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ title: { contains: query } }, { provider: { contains: query } }],
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
      where: { OR: [{ title: { contains: query } }, { category: { contains: query } }] },
      take: limit,
    }),
  ]);

  // Fields are static — filter client-side data
  const { FIELDS } = await import("./constants");
  const fields = FIELDS.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())).slice(0, limit);

  return { scholarships, universities, countries, fields, articles };
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
