import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FIELDS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Explore Fields of Study",
  description:
    "Browse scholarships by field of study — from computer science and medicine to arts and engineering.",
  alternates: { canonical: "/fields" },
};

export default async function FieldsPage() {
  const rows = await prisma.scholarship.findMany({
    where: { status: "ACTIVE" },
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

  const fields = FIELDS.map((f) => ({ ...f, count: counts.get(f.slug) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Explore by Field of Study</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Whatever you want to study, there&apos;s funding out there. Pick a field to see matching
          scholarships.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              <h2 className="truncate font-display font-bold">{f.name}</h2>
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
