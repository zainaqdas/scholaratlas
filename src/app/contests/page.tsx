import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { searchScholarships } from "@/lib/search";
import { SearchBar } from "@/components/search-bar";
import { ScholarshipCard } from "@/components/scholarship/scholarship-card";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/empty-state";
import { SavedStateProvider } from "@/components/saved-state";
import { dbCached } from "@/lib/search";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Contests, Prizes & Competitions",
  description:
    "University prizes, essay competitions, hackathons and contests from around the world — a separate section from scholarships, kept for easy reference.",
  alternates: { canonical: "/contests" },
};

// ISR: the contest section changes only on the weekly re-crawl, same as the rest
// of the catalogue — cache for 6 hours and let the counts refresh on the cron.
export const revalidate = 21600;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ContestsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) value.forEach((v) => usp.append(key, v));
    else if (value !== undefined) usp.set(key, value);
  }

  const q = usp.get("q")?.trim() ?? "";
  const status = (usp.get("status") ?? "ACTIVE").toUpperCase();
  const page = Math.max(1, Number(usp.get("page")) || 1);

  const result = await searchScholarships({
    recordType: "CONTEST",
    q: q || undefined,
    status,
    sort: "recent",
    page,
  });

  // Persisted in the Turso cache — unstable_cache does NOT survive across
  // requests/ISR regenerations on Vercel, so without this every re-render
  // re-ran the two counts. 7d TTL: contests only change on the weekly re-crawl.
  const counts = await dbCached(
    "contest-counts-v2",
    7 * 24 * 60 * 60 * 1000,
    async () => {
      const [active, expired] = await Promise.all([
        prisma.scholarship.count({ where: { recordType: "CONTEST", status: "ACTIVE" } }),
        prisma.scholarship.count({ where: { recordType: "CONTEST", status: "EXPIRED" } }),
      ]);
      return { active, expired };
    }
  );

  const statusChip = (value: string, label: string, count?: number) => {
    const active = status === value;
    return (
      <Link
        key={value}
        href={value === "ACTIVE" ? `/contests${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/contests?status=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
        aria-current={active ? "true" : undefined}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
          active
            ? "border-brand-blue/50 bg-brand-blue/10 text-brand-blue dark:border-blue-400/50 dark:bg-blue-400/15 dark:text-blue-300"
            : "border-border bg-card text-muted-foreground hover:border-brand-blue/30 hover:text-foreground"
        }`}
      >
        {label}
        {count !== undefined && <span className="opacity-70">{count}</span>}
      </Link>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:text-primary">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/scholarships" className="hover:text-primary">Scholarships</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">Contests &amp; Prizes</li>
        </ol>
      </nav>

      <div className="max-w-3xl">
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue to-brand-indigo text-white">
          <Trophy className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight">
          Contests, Prizes &amp; Competitions
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          University prizes, essay competitions, hackathons and contests from around the world.
          These are kept in a separate section from <Link href="/scholarships" className="font-medium text-primary hover:underline">scholarships</Link> —
          they reward achievement or competition rather than funding a programme of study.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Contests appear here for reference and discovery. Always check the official website for
          rules, eligibility and deadlines.
        </p>
      </div>

      <div className="mt-8 max-w-2xl">
        <SearchBar variant="compact" defaultValue={q} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {statusChip("ACTIVE", "Open", counts.active)}
        {statusChip("EXPIRED", "Closed", counts.expired)}
        {statusChip("ALL", "All", counts.active + counts.expired)}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
          <span className="font-bold text-foreground">{result.total.toLocaleString()}</span>{" "}
          {result.total === 1 ? "Contest / Prize" : "Contests & Prizes"}{" "}
          {status === "EXPIRED" ? "Closed" : status === "ALL" ? "Listed" : "Open"}
        </p>
        <Link href="/scholarships" className="text-sm font-semibold text-primary hover:underline">
          Back to Scholarships →
        </Link>
      </div>

      {result.items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No Contests Found"
            description="Try changing your search or broadening the status filter."
            action={{ label: "Clear Filters", href: "/contests" }}
          />
        </div>
      ) : (
        <SavedStateProvider ids={result.items.map((i) => i.id)}>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((s) => (
              <ScholarshipCard key={s.id} scholarship={s} />
            ))}
          </div>
        </SavedStateProvider>
      )}

      <div className="mt-10">
        <Pagination page={result.page} pageCount={result.pageCount} basePath="/contests" searchParams={usp} />
      </div>
    </div>
  );
}
