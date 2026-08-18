import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FIELDS, FIELD_GROUPS } from "@/lib/constants";
import { CATALOGUE_TTL, cachedData } from "@/lib/data-cache";

export const metadata: Metadata = {
  title: "Explore Fields of Study",
  description:
    "Browse scholarships by field of study — from computer science and medicine to arts and engineering.",
  alternates: { canonical: "/fields" },
};

// Heavy read: scans the `fields` column of every ACTIVE scholarship (~9,300
// rows) per view. Field counts only change on the weekly re-crawl, so the whole
// computation is cached across requests.
const getFieldCounts = cachedData(
  ["field-counts"],
  async () => {
    const rows = await prisma.scholarship.findMany({
      where: { status: "ACTIVE", recordType: "SCHOLARSHIP" },
      select: { fields: true },
    });

    const counts = new Map<string, number>();
    for (const row of rows) {
      try {
        const fields = JSON.parse(row.fields) as string[];
        for (const f of fields) {
          if (f === "ALL") continue;
          counts.set(f, (counts.get(f) ?? 0) + 1);
        }
      } catch {
        // ignore
      }
    }

    // A group's count is the union of its children (a record tagged with several
    // children of the same group is counted once).
    const groups = FIELD_GROUPS.map((g) => {
      const children = new Set(g.children);
      let n = 0;
      for (const row of rows) {
        try {
          const f = JSON.parse(row.fields) as string[];
          if (f.some((x) => children.has(x))) n++;
        } catch {
          // ignore
        }
      }
      return { slug: g.slug, count: n };
    });

    const fieldCounts = FIELDS.map((f) => ({ slug: f.slug, count: counts.get(f.slug) ?? 0 }))
      .sort((a, b) => b.count - a.count);

    return {
      fieldCounts: fieldCounts.map((f) => ({ slug: f.slug, count: f.count })),
      groupCounts: groups.map((g) => ({ slug: g.slug, count: g.count })),
    };
  },
  CATALOGUE_TTL
);

export default async function FieldsPage() {
  const { fieldCounts, groupCounts } = await getFieldCounts();

  const groupCount = new Map(groupCounts.map((g) => [g.slug, g.count]));
  const fieldCount = new Map(fieldCounts.map((f) => [f.slug, f.count]));
  const groups = FIELD_GROUPS.map((g) => ({ ...g, count: groupCount.get(g.slug) ?? 0 }));
  const fields = FIELDS.map((f) => ({ ...f, count: fieldCount.get(f.slug) ?? 0 }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Explore by Field of Study</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Whatever you want to study, there&apos;s funding out there. Pick a broad category to see
          every related field, or jump straight to a specific field.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <Link
            key={g.slug}
            href={`/fields/${g.slug}`}
            className="lift group flex items-start gap-4 rounded-2xl border bg-card p-5"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue/15 to-brand-indigo/15 text-2xl">
              {g.icon}
            </span>
            <div className="min-w-0">
              <h2 className="font-display font-bold group-hover:text-brand-blue">{g.name}</h2>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {g.description}
              </p>
              <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                {g.count > 0 ? `${g.count} scholarships` : "Explore opportunities"}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-14 flex items-center gap-3">
        <h2 className="font-display text-2xl font-bold">All Fields</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {fields.map((f) => (
          <Link
            key={f.slug}
            href={`/fields/${f.slug}`}
            className="lift flex items-center gap-4 rounded-2xl border bg-card p-5"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue/15 to-brand-indigo/15 text-2xl">
              {f.icon}
            </span>
            <div className="min-w-0">
              <h3 className="truncate font-display font-bold">{f.name}</h3>
              <p className="text-xs text-muted-foreground">
                {f.count > 0 ? `${f.count} scholarships` : "Explore opportunities"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
