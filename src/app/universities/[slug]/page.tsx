import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { countryFlag, countryName } from "@/lib/constants";
import { ScholarshipCard } from "@/components/scholarship/scholarship-card";
import { UniversityLogo } from "@/components/scholarship/university-logo";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const u = await prisma.university.findUnique({ where: { slug } });
  if (!u) return { title: "University not found" };
  return {
    title: `${u.name} — Scholarships & Programs`,
    description: `Scholarships and funding opportunities at ${u.name}, ${u.city ?? ""} ${countryName(u.countryCode)}.`,
    alternates: { canonical: `/universities/${u.slug}` },
  };
}

export default async function UniversityPage({ params }: PageProps) {
  const { slug } = await params;
  const university = await prisma.university.findUnique({
    where: { slug },
    include: {
      country: true,
      // Scholarships only — EURAXESS-style job listings are a separate record
      // type and are not shown under "Scholarships at …".
      scholarships: { where: { status: "ACTIVE", recordType: "SCHOLARSHIP" } },
    },
  });
  if (!university) notFound();

  const user = await getCurrentUser();
  let savedIds = new Set<string>();
  if (user && university.scholarships.length) {
    const saved = await prisma.savedScholarship.findMany({
      where: { userId: user.id, scholarshipId: { in: university.scholarships.map((s) => s.id) } },
      select: { scholarshipId: true },
    });
    savedIds = new Set(saved.map((s) => s.scholarshipId));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm text-muted-foreground">
        <Link href="/universities" className="hover:text-primary">Universities</Link> / {university.name}
      </p>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
        <UniversityLogo text={university.logoText} color={university.color} name={university.name} size="lg" className="h-20 w-20 rounded-2xl text-2xl" />
        <div className="flex-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{university.name}</h1>
          <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {countryFlag(university.countryCode)} {university.city ? `${university.city}, ` : ""}
            {university.country?.name ?? countryName(university.countryCode)}
          </p>
          {university.about && <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">{university.about}</p>}
          {university.website && (
            <Button asChild variant="outline" className="mt-4 gap-1.5">
              <a href={university.website} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Official Website
              </a>
            </Button>
          )}
        </div>
      </div>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">
          Scholarships at {university.name}
        </h2>
        {university.scholarships.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
            No scholarships listed for this university yet.
          </p>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {university.scholarships.map((s) => (
              <ScholarshipCard key={s.id} scholarship={s} saved={savedIds.has(s.id)} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Explore More</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/scholarships?country=${university.countryCode}`}
            className="rounded-full border bg-card px-4 py-2 text-sm font-medium hover:border-brand-blue/40 hover:text-brand-blue"
          >
            All {countryName(university.countryCode)} scholarships
          </Link>
          <Link
            href={`/countries/${university.countryCode.toLowerCase()}`}
            className="rounded-full border bg-card px-4 py-2 text-sm font-medium hover:border-brand-blue/40 hover:text-brand-blue"
          >
            {countryFlag(university.countryCode)} {countryName(university.countryCode)} country page
          </Link>
        </div>
      </section>
    </div>
  );
}
