import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, Sparkles, TrendingUp } from "lucide-react";
import { cachedHighlightSections, parseFiltersFromUrl, searchScholarships } from "@/lib/search";
import { FilterSidebar } from "@/components/filters/filter-sidebar";
import { MobileFilterSheet } from "@/components/filters/mobile-filter-sheet";
import { SearchBar } from "@/components/search-bar";
import { ScholarshipCard } from "@/components/scholarship/scholarship-card";
import { ScholarshipCardList } from "@/components/scholarship/scholarship-card-list";
import { LiveDeadlineBadge } from "@/components/scholarship/live-deadline-badge";
import { ResultsToolbar } from "@/components/scholarships/toolbar";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { CompareTray } from "@/components/compare/compare-tray";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countryFlag, countryName } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Find Scholarships",
  description:
    "Search thousands of scholarships, fellowships and fully funded opportunities by country, study level, field and funding type.",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ScholarshipsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) value.forEach((v) => usp.append(key, v));
    else if (value !== undefined) usp.set(key, value);
  }

  const filters = parseFiltersFromUrl(usp);
  const view = usp.get("view") === "list" ? "list" : "grid";
  const result = await searchScholarships(filters);

  // Highlight sections (Featured / Trending / Closing Soon) only on the clean
  // first page — i.e. no filters, no search, not a paginated page. Filtered or
  // searched views go straight to results. The section data itself is cached
  // in Turso (see cachedHighlightSections), so it costs one lookup per request.
  const isFirstPage = !filters.page || filters.page === 1;
  const hasActiveFilters = !!(
    filters.q ||
    filters.levels?.length ||
    filters.funding?.length ||
    filters.countries?.length ||
    filters.nationality ||
    filters.field ||
    filters.deadline ||
    filters.providers?.length ||
    filters.languages?.length ||
    filters.fee ||
    filters.verifiedOnly ||
    filters.featuredOnly ||
    (filters.status && filters.status !== "ACTIVE") ||
    (filters.sort && filters.sort !== "relevance")
  );
  const showSections = isFirstPage && !hasActiveFilters;
  const sections = showSections ? await cachedHighlightSections() : null;

  // Saved set for logged-in users
  const user = await getCurrentUser();
  let savedIds = new Set<string>();
  if (user && result.items.length) {
    const saved = await prisma.savedScholarship.findMany({
      where: { userId: user.id, scholarshipId: { in: result.items.map((i) => i.id) } },
      select: { scholarshipId: true },
    });
    savedIds = new Set(saved.map((s) => s.scholarshipId));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {filters.status === "EXPIRED" ? "Closed Scholarships" : "Find Your Scholarship"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {filters.status === "EXPIRED"
            ? "Previously listed scholarships that are now closed — kept for reference and research."
            : "Search by country, degree level, field, funding and more."}
        </p>
        <div className="mt-5 max-w-2xl">
          <SearchBar variant="compact" defaultValue={filters.q ?? ""} />
        </div>
      </div>

      {sections && (
        <div className="mb-12 space-y-14">
          <HighlightSection
            id="featured"
            title={
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Featured Opportunities
              </span>
            }
            subtitle="Hand-picked, verified scholarships from trusted providers."
            action={{ href: "/scholarships?featured=1", label: "View all" }}
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {sections.featured.map((s) => (
                <ScholarshipCard key={s.id} scholarship={s} />
              ))}
            </div>
          </HighlightSection>

          <HighlightSection
            id="trending"
            title={
              <span className="inline-flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Trending This Week
              </span>
            }
            subtitle="Ranked by views, saves and recency — updated automatically."
            action={{ href: "/scholarships?sort=popular", label: "View all" }}
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {sections.trending.map((s) => (
                <ScholarshipCard key={s.id} scholarship={s} />
              ))}
            </div>
          </HighlightSection>

          <HighlightSection
            id="closing-soon"
            title={
              <span className="inline-flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                Closing Soon
              </span>
            }
            subtitle="Don't miss a deadline — these opportunities close first."
            action={{ href: "/scholarships?sort=deadline", label: "View all" }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {sections.closingSoon.map((s) => (
                <Link
                  key={s.id}
                  href={`/scholarships/${s.slug}`}
                  className="lift flex items-center justify-between gap-4 rounded-2xl border bg-card p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {countryFlag(s.countryCode)} {countryName(s.countryCode)} · {s.provider}
                    </p>
                  </div>
                  <LiveDeadlineBadge scholarship={s} className="shrink-0" />
                </Link>
              ))}
            </div>
          </HighlightSection>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        {/* Desktop filter sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border bg-card p-5">
            <FilterSidebar searchParams={usp} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3 lg:hidden">
            <MobileFilterSheet searchParams={usp} />
          </div>

          <div className="mt-4 lg:mt-0">
            <ResultsToolbar searchParams={usp} view={view} total={result.total} />
          </div>

          {result.items.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="No Scholarships Found"
                description="Try changing your filters or broadening your search."
                action={{ label: "Clear Filters", href: "/scholarships" }}
              />
            </div>
          ) : view === "grid" ? (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((s) => (
                <div key={s.id} className="relative min-w-0">
                  <ScholarshipCard scholarship={s} saved={savedIds.has(s.id)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {result.items.map((s) => (
                <ScholarshipCardList key={s.id} scholarship={s} saved={savedIds.has(s.id)} />
              ))}
            </div>
          )}

          <div className="mt-10">
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              basePath="/scholarships"
              searchParams={usp}
            />
          </div>
        </div>
      </div>

      <CompareTray />
    </div>
  );
}

function HighlightSection({
  id,
  title,
  subtitle,
  action,
  children,
}: {
  id: string;
  title: React.ReactNode;
  subtitle?: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section id={id}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
          {subtitle && <p className="mt-2 max-w-2xl text-muted-foreground">{subtitle}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            {action.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}
