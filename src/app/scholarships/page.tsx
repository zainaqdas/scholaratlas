import type { Metadata } from "next";
import { SlidersHorizontal } from "lucide-react";
import { searchScholarships, parseFiltersFromUrl } from "@/lib/search";
import { FilterSidebar } from "@/components/filters/filter-sidebar";
import { SearchBar } from "@/components/search-bar";
import { ScholarshipCard } from "@/components/scholarship/scholarship-card";
import { ScholarshipCardList } from "@/components/scholarship/scholarship-card-list";
import { ResultsToolbar } from "@/components/scholarships/toolbar";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { CompareTray } from "@/components/compare/compare-tray";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* Desktop filter sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border bg-card p-5">
            <FilterSidebar searchParams={usp} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <FilterSidebar searchParams={usp} />
                </div>
              </SheetContent>
            </Sheet>
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
            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((s) => (
                <div key={s.id} className="relative">
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
