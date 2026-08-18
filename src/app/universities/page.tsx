import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { UniversityLogo } from "@/components/scholarship/university-logo";
import { countryFlag, countryName } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Explore Universities",
  description:
    "Browse universities offering scholarships and funding opportunities for international students around the world.",
  alternates: { canonical: "/universities" },
};

export default async function UniversitiesPage() {
  const universities = await prisma.university.findMany({
    include: {
      country: true,
      // Scholarships only — job listings (EURAXESS research positions) are a
      // separate record type and must not inflate "N scholarships" counts.
      _count: { select: { scholarships: { where: { status: "ACTIVE", recordType: "SCHOLARSHIP" } } } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Explore Universities</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Discover universities offering scholarships, fellowships and funding for international
          students.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {universities.map((u) => (
          <Link
            key={u.id}
            href={`/universities/${u.slug}`}
            className="lift flex items-center gap-4 rounded-2xl border bg-card p-5"
          >
            <UniversityLogo text={u.logoText} color={u.color} name={u.name} size="lg" />
            <div className="min-w-0">
              <h2 className="truncate font-display font-bold">{u.name}</h2>
              <p className="text-xs text-muted-foreground">
                {countryFlag(u.countryCode)} {u.country?.name ?? countryName(u.countryCode)}
              </p>
              <p className="mt-1 text-xs font-medium text-primary">
                {u._count.scholarships} scholarships
              </p>
            </div>
          </Link>
        ))}
      </div>

      {universities.length === 0 && (
        <p className="mt-10 text-muted-foreground">No universities listed yet.</p>
      )}
    </div>
  );
}
