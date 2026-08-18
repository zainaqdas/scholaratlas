import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Globe2 } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FIELDS, countryByCode, countryFlag, countryName, studyLevelFromSlug } from "@/lib/constants";
import { ScholarshipCard } from "@/components/scholarship/scholarship-card";
import { UniversityLogo } from "@/components/scholarship/university-logo";
import { getCurrentUser } from "@/lib/auth";

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const country = countryByCode(code);
  if (!country) return { title: "Country not found" };
  return {
    title: `Scholarships in ${country.name}`,
    description: `Browse scholarships, universities and funding opportunities in ${country.name} for international students.`,
    alternates: { canonical: `/countries/${code.toLowerCase()}` },
  };
}

export default async function CountryPage({ params }: PageProps) {
  const { code } = await params;
  const country = countryByCode(code);
  if (!country) notFound();

  const scholarshipWhere: Prisma.ScholarshipWhereInput = {
    status: "ACTIVE",
    recordType: "SCHOLARSHIP",
    countryCode: country.code,
  };
  const [scholarships, total, universities, user] = await Promise.all([
    prisma.scholarship.findMany({
      where: scholarshipWhere,
      include: { university: true },
      orderBy: { views: "desc" },
      take: 12,
    }),
    prisma.scholarship.count({ where: scholarshipWhere }),
    prisma.university.findMany({
      where: { countryCode: country.code },
      orderBy: { name: "asc" },
    }),
    getCurrentUser(),
  ]);

  let savedIds = new Set<string>();
  if (user && scholarships.length) {
    const saved = await prisma.savedScholarship.findMany({
      where: { userId: user.id, scholarshipId: { in: scholarships.map((s) => s.id) } },
      select: { scholarshipId: true },
    });
    savedIds = new Set(saved.map((s) => s.scholarshipId));
  }

  // Popular fields in this country
  const fieldCounts = new Map<string, number>();
  for (const s of scholarships) {
    try {
      for (const f of JSON.parse(s.fields) as string[]) {
        if (f === "ALL") continue;
        fieldCounts.set(f, (fieldCounts.get(f) ?? 0) + 1);
      }
    } catch {
      // ignore
    }
  }
  const topFields = [...fieldCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/countries" className="hover:text-primary">Countries</Link> /{" "}
            {country.name}
          </p>
          <h1 className="mt-2 flex items-center gap-3 font-display text-4xl font-extrabold tracking-tight">
            <span aria-hidden="true">{country.flag}</span>
            Scholarships in {country.name}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {total} active opportunities currently listed. Explore universities,
            funding programmes and popular fields of study in {country.name}.
          </p>
        </div>
        <Link
          href={`/scholarships?country=${country.code}`}
          className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-blue to-brand-indigo px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 sm:inline-flex"
        >
          See all {country.name} scholarships
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 className="font-display text-xl font-bold">Scholarships in {country.name}</h2>
          {scholarships.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
              No scholarships listed for {country.name} yet.{" "}
              <Link href="/submit-scholarship" className="font-medium text-primary hover:underline">
                Submit one
              </Link>
            </p>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {scholarships.map((s) => (
                <ScholarshipCard key={s.id} scholarship={s} saved={savedIds.has(s.id)} />
              ))}
            </div>
          )}

          {topFields.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-xl font-bold">Popular Fields in {country.name}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {topFields.map(([slug, count]) => {
                  const field = FIELDS.find((f) => f.slug === slug);
                  if (!field) return null;
                  return (
                    <Link
                      key={slug}
                      href={`/fields/${slug}`}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-sm transition-colors hover:border-brand-blue/40 hover:text-brand-blue"
                    >
                      {field.icon} {field.name}
                      <span className="text-xs text-muted-foreground">({count})</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-display text-lg font-bold">Universities</h2>
            {universities.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No universities listed yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {universities.map((u) => (
                  <li key={u.id}>
                    <Link href={`/universities/${u.slug}`} className="group flex items-center gap-3">
                      <UniversityLogo text={u.logoText} color={u.color} name={u.name} size="sm" />
                      <span className="text-sm font-medium group-hover:text-primary">{u.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-display text-lg font-bold">Quick Links</h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li>
                <Link href={`/scholarships?country=${country.code}&funding=FULLY_FUNDED,FULLY_FUNDED_STIPEND`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                  <Globe2 className="h-4 w-4" /> Fully funded in {country.name}
                </Link>
              </li>
              <li>
                <Link href={`/scholarships?country=${country.code}&level=phd`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                  <Globe2 className="h-4 w-4" /> PhD in {country.name}
                </Link>
              </li>
              <li>
                <Link href={`/scholarships?country=${country.code}&level=masters`} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                  <Globe2 className="h-4 w-4" /> Master's in {country.name}
                </Link>
              </li>
              <li>
                <Link href="/resources" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                  <Globe2 className="h-4 w-4" /> Application resources
                </Link>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-display text-lg font-bold">Study Levels Available</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[...new Set(scholarships.flatMap((s) => {
                try { return (JSON.parse(s.studyLevels) as string[]).map((l) => studyLevelFromSlug(l)).filter(Boolean); } catch { return []; }
              }))].map((level) => (
                <span key={level} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                  {level}
                </span>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
