import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { searchScholarships, buildSearchUrl } from "@/lib/search";
import type { CategoryPageDef } from "@/lib/categories";
import { ScholarshipCard } from "@/components/scholarship/scholarship-card";
import { SearchBar } from "@/components/search-bar";
import { Badge } from "@/components/ui/badge";
import { getBaseUrl } from "@/lib/app-url";
import { getCurrentUser } from "@/lib/auth";

export async function CategoryPage({ category }: { category: CategoryPageDef }) {
  const appUrl = await getBaseUrl();
  const [result, user] = await Promise.all([
    searchScholarships({ ...category.filters, sort: "recent" }),
    getCurrentUser(),
  ]);

  let savedIds = new Set<string>();
  if (user && result.items.length) {
    const saved = await prisma.savedScholarship.findMany({
      where: { userId: user.id, scholarshipId: { in: result.items.map((i) => i.id) } },
      select: { scholarshipId: true },
    });
    savedIds = new Set(saved.map((s) => s.scholarshipId));
  }

  const refineUrl = buildSearchUrl(category.filters);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <ol className="flex items-center gap-1.5">
          <li><Link href="/" className="hover:text-primary">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/scholarships" className="hover:text-primary">Scholarships</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">{category.title}</li>
        </ol>
      </nav>

      <div className="max-w-3xl">
        <Badge variant="secondary" className="mb-4">
          {result.total} opportunities
        </Badge>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">{category.headline}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{category.intro}</p>
      </div>

      <div className="mt-8 max-w-2xl">
        <SearchBar variant="compact" />
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Latest {category.title.toLowerCase()}</h2>
        <Link
          href={refineUrl}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          Refine with all filters
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {result.items.map((s) => (
          <ScholarshipCard key={s.id} scholarship={s} saved={savedIds.has(s.id)} />
        ))}
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-xl font-bold">Frequently Asked Questions</h2>
          <div className="mt-5 space-y-3">
            {category.faqs.map((faq) => (
              <details key={faq.q} className="group rounded-xl border bg-card p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold">Related Categories</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {category.related.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-brand-blue/40 hover:text-brand-blue"
              >
                {r.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Structured data: breadcrumbs + collection page */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: `${appUrl}/` },
                  { "@type": "ListItem", position: 2, name: "Scholarships", item: `${appUrl}/scholarships` },
                  { "@type": "ListItem", position: 3, name: category.title },
                ],
              },
              {
                "@type": "CollectionPage",
                name: category.headline,
                description: category.intro,
                url: `${appUrl}/scholarships/${category.slug}`,
              },
            ],
          }),
        }}
      />
    </div>
  );
}
