import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FIELDS, FIELD_GROUPS, fieldBySlug, fieldGroupBySlug, fieldSlugsForFilter } from "@/lib/constants";
import { ScholarshipCard } from "@/components/scholarship/scholarship-card";
import { getCurrentUser } from "@/lib/auth";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const field = fieldBySlug(slug) ?? fieldGroupBySlug(slug);
  if (!field) return { title: "Field not found" };
  return {
    title: `${field.name} Scholarships`,
    description: `Scholarships and funding opportunities for ${field.name} students — from governments, universities and foundations worldwide.`,
    alternates: { canonical: `/fields/${slug}` },
  };
}

export default async function FieldPage({ params }: PageProps) {
  const { slug } = await params;
  const field = fieldBySlug(slug) ?? fieldGroupBySlug(slug);
  if (!field) notFound();

  const filterSlugs = fieldSlugsForFilter(slug);
  const isGroup = !!fieldGroupBySlug(slug);

  const where: Prisma.ScholarshipWhereInput = {
    status: "ACTIVE",
    recordType: "SCHOLARSHIP",
    // Match every leaf slug in the group (or the leaf itself) plus the "ALL"
    // marker (open to all fields), same as the search page's field filter.
    OR: [
      ...(filterSlugs ?? []).map((s) => ({ fields: { contains: `"${s}"` } })),
      { fields: { contains: '"ALL"' } },
    ],
  };
  const [scholarships, total, user] = await Promise.all([
    prisma.scholarship.findMany({
      where,
      include: { university: true },
      orderBy: { views: "desc" },
      take: 24,
    }),
    prisma.scholarship.count({ where }),
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

  // Sub-fields for group pages (with their own counts); other categories for
  // group pages' bottom section; related fields for leaf pages.
  const subFields = isGroup
    ? FIELDS.filter((f) => fieldGroupBySlug(slug)?.children.includes(f.slug))
    : [];
  const related = isGroup
    ? FIELD_GROUPS.filter((g) => g.slug !== slug).slice(0, 12)
    : FIELDS.filter((f) => f.slug !== slug).slice(0, 10);

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
            {total} matching opportunities currently listed.
          </p>
        </div>
      </div>

      {isGroup && subFields.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground">Sub-fields</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {subFields.map((f) => (
              <Link
                key={f.slug}
                href={`/fields/${f.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-brand-blue/40 hover:text-brand-blue"
              >
                <span aria-hidden="true">{f.icon}</span>
                {f.name}
              </Link>
            ))}
          </div>
        </section>
      )}

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
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {scholarships.map((s) => (
            <ScholarshipCard key={s.id} scholarship={s} saved={savedIds.has(s.id)} />
          ))}
        </div>
      )}

      <section className="mt-14">
        <h2 className="font-display text-xl font-bold">{isGroup ? "Other Categories" : "Related Fields"}</h2>
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
