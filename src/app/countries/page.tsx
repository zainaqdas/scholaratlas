import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { COUNTRIES, countryFlag, countryName } from "@/lib/constants";
import { CATALOGUE_TTL, cachedData } from "@/lib/data-cache";

export const metadata: Metadata = {
  title: "Explore Scholarships by Country",
  description:
    "Browse scholarships by destination country — from government programmes to university awards around the world.",
  alternates: { canonical: "/countries" },
};

// Heavy read: three aggregate scans over the ACTIVE scholarship table per view.
// Counts only change on the weekly re-crawl, so they're cached across requests.
const getCountryCounts = cachedData(
  ["country-counts"],
  async () => {
    const [rows, fullyFunded, unis, globalCount, globalFF] = await Promise.all([
      prisma.scholarship.groupBy({
        by: ["countryCode"],
        where: { status: "ACTIVE" },
        _count: { _all: true },
      }),
      prisma.scholarship.groupBy({
        by: ["countryCode"],
        where: { status: "ACTIVE", fundingType: { in: ["FULLY_FUNDED", "FULLY_FUNDED_STIPEND"] } },
        _count: { _all: true },
      }),
      prisma.university.groupBy({
        by: ["countryCode"],
        _count: { _all: true },
      }),
      prisma.scholarship.count({ where: { status: "ACTIVE", countryCode: null } }),
      prisma.scholarship.count({
        where: {
          status: "ACTIVE",
          countryCode: null,
          fundingType: { in: ["FULLY_FUNDED", "FULLY_FUNDED_STIPEND"] },
        },
      }),
    ]);
    return {
      counts: rows.map((r) => [r.countryCode, r._count._all] as const),
      ffCounts: fullyFunded.map((r) => [r.countryCode, r._count._all] as const),
      uniCounts: unis.map((r) => [r.countryCode, r._count._all] as const),
      globalCount,
      globalFF,
    };
  },
  CATALOGUE_TTL
);

export default async function CountriesPage() {
  const { counts: countRows, ffCounts: ffRows, uniCounts: uniRows, globalCount, globalFF } =
    await getCountryCounts();
  const counts = new Map(countRows);
  const ffCounts = new Map(ffRows);
  const uniCounts = new Map(uniRows);

  const countries = COUNTRIES.filter((c) => counts.has(c.code) || uniCounts.has(c.code))
    .map((c) => ({
      ...c,
      count: counts.get(c.code) ?? 0,
      fullyFunded: ffCounts.get(c.code) ?? 0,
      universities: uniCounts.get(c.code) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Explore Scholarships by Country</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          From fully funded government programmes to university awards — find what&apos;s available in
          your dream destination.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {globalCount > 0 && (
          <Link
            href="/scholarships/global"
            className="lift flex flex-col rounded-2xl border bg-card p-5"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden="true">🪐</span>
              <div>
                <h2 className="font-display font-bold">Global &amp; Multi-Country</h2>
                <p className="text-xs text-muted-foreground">Multiple destinations</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm">
              <span className="font-semibold">{globalCount} scholarships</span>
              {globalFF > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400">{globalFF} fully funded</span>
              )}
            </div>
          </Link>
        )}
        {countries.map((c) => (
          <Link
            key={c.code}
            href={`/countries/${c.code.toLowerCase()}`}
            className="lift flex flex-col rounded-2xl border bg-card p-5"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden="true">{c.flag}</span>
              <div>
                <h2 className="font-display font-bold">{c.name}</h2>
                <p className="text-xs text-muted-foreground">{c.region}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm">
              <span className="font-semibold">{c.count} scholarships</span>
              {c.fullyFunded > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400">{c.fullyFunded} fully funded</span>
              )}
              {c.universities > 0 && (
                <span className="text-muted-foreground">{c.universities} universities</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {countries.length === 0 && (
        <p className="mt-10 text-muted-foreground">No country data available yet.</p>
      )}
    </div>
  );
}
