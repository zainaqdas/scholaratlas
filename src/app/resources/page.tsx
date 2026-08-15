import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Resources & Guides",
  description:
    "Guides on finding scholarships, writing applications, preparing for IELTS/TOEFL and studying abroad.",
  alternates: { canonical: "/resources" },
};

const CATEGORY_COLORS: Record<string, string> = {
  Scholarships: "from-brand-blue to-brand-indigo",
  "Study Abroad": "from-brand-emerald to-brand-cyan",
  Applications: "from-brand-indigo to-brand-cyan",
  Tests: "from-amber-500 to-orange-500",
};

export default async function ResourcesPage() {
  const articles = await prisma.article.findMany({ orderBy: { publishedAt: "desc" } });
  const categories = [...new Set(articles.map((a) => a.category))];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Resources & Guides</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Practical guides to finding funding, writing strong applications and studying abroad.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((c) => (
          <span key={c} className="rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium">
            {c}
          </span>
        ))}
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => {
          const gradient = CATEGORY_COLORS[a.category] ?? "from-brand-blue to-brand-indigo";
          return (
            <Link key={a.id} href={`/resources/${a.slug}`} className="lift group overflow-hidden rounded-2xl border bg-card">
              <div className={`flex h-36 items-center justify-center bg-gradient-to-br ${gradient}`}>
                <span className="text-4xl opacity-90" aria-hidden="true">
                  {a.category === "Scholarships" ? "🎓" : a.category === "Study Abroad" ? "🌍" : a.category === "Applications" ? "📝" : "📚"}
                </span>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{a.category}</Badge>
                  <span className="text-xs text-muted-foreground">{a.readingTime} min read</span>
                </div>
                <h2 className="mt-3 font-display text-lg font-bold leading-snug group-hover:text-primary">
                  {a.title}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>
                <p className="mt-4 text-xs text-muted-foreground">
                  {a.author} · {formatDate(a.publishedAt)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
