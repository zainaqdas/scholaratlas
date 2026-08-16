import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FIELDS, fieldBySlug } from "@/lib/constants";
import { ScholarshipCard } from "@/components/scholarship/scholarship-card";
import { getCurrentUser } from "@/lib/auth";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const field = fieldBySlug(slug);
  if (!field) return { title: "Field not found" };
  return {
    title: `${field.name} Scholarships`,
    description: `Scholarships and funding opportunities for ${field.name} students — from governments, universities and foundations worldwide.`,
    alternates: { canonical: `/fields/${field.slug}` },
  };
}

export default async function FieldPage({ params }: PageProps) {
  const { slug } = await params;
  const field = fieldBySlug(slug);
  if (!field) notFound();

  const [scholarships, user] = await Promise.all([
    prisma.scholarship.findMany({
      where: {
        status: "ACTIVE",
        recordType: "SCHOLARSHIP",
        fields: { contains: slug },
      },
      include: { university: true },
      orderBy: { views: "desc" },
      take: 24,
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

  const related = FIELDS.filter((f) => f.slug !== slug).slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-sm text-muted-foreground">
        <Link href="/fields" className="hover:text-primary">Fields of Study</Link> / {field.name}
      </p>

      <div className="mt-4 flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue/15 to-brand-indigo/15 text-3xl">
          {field.icon}
        </span>
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">{field.name} Scholarships</h1>
          <p className="mt-1 text-muted-foreground">
            {scholarships.length} matching opportunities currently listed.
          </p>
        </div>
      </div>

      {scholarships.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed bg-card p-12 text-center">
          <p className="text-muted-foreground">
            No {field.name.toLowerCase()} scholarships listed yet.{" "}
            <Link href="/scholarships" className="font-medium text-primary hover:underline">
              Browse all scholarships
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {scholarships.map((s) => (
            <ScholarshipCard key={s.id} scholarship={s} saved={savedIds.has(s.id)} />
          ))}
        </div>
      )}

      <section className="mt-14">
        <h2 className="font-display text-xl font-bold">Related Fields</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {related.map((f) => (
            <Link
              key={f.slug}
              href={`/fields/${f.slug}`}
              className="rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-brand-blue/40 hover:text-brand-blue"
            >
              {f.icon} {f.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
