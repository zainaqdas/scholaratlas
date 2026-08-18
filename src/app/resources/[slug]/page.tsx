import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { ScholarshipCard } from "@/components/scholarship/scholarship-card";
import { formatDate } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await prisma.article.findUnique({ where: { slug } });
  if (!article) return { title: "Article not found" };
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/resources/${article.slug}` },
    openGraph: { type: "article", title: article.title, description: article.excerpt ?? undefined },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await prisma.article.findUnique({ where: { slug } });
  if (!article) notFound();

  const relatedSlugs = (() => {
    try {
      return JSON.parse(article.relatedScholarships) as string[];
    } catch {
      return [];
    }
  })();

  const [related, user] = await Promise.all([
    relatedSlugs.length
      ? prisma.scholarship.findMany({
          where: { slug: { in: relatedSlugs }, status: "ACTIVE", recordType: "SCHOLARSHIP" },
          include: { university: true },
        })
      : Promise.resolve([]),
    getCurrentUser(),
  ]);

  let savedIds = new Set<string>();
  if (user && related.length) {
    const saved = await prisma.savedScholarship.findMany({
      where: { userId: user.id, scholarshipId: { in: related.map((s) => s.id) } },
      select: { scholarshipId: true },
    });
    savedIds = new Set(saved.map((s) => s.scholarshipId));
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li><Link href="/resources" className="hover:text-primary">Resources</Link></li>
          <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
          <li aria-current="page" className="truncate text-foreground">{article.title}</li>
        </ol>
      </nav>

      <Badge variant="secondary">{article.category}</Badge>
      <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
        {article.title}
      </h1>
      <p className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
        <span>{article.author}</span>
        <span aria-hidden="true">·</span>
        <span>{formatDate(article.publishedAt)}</span>
        <span aria-hidden="true">·</span>
        <span>{article.readingTime} min read</span>
      </p>

      <div className="prose-sm mt-8 space-y-4 leading-relaxed text-foreground/90">
        {article.body.split("\n\n").map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-extrabold tracking-tight">Related Scholarships</h2>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {related.map((s) => (
              <ScholarshipCard key={s.id} scholarship={s} saved={savedIds.has(s.id)} />
            ))}
          </div>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description: article.excerpt,
            author: { "@type": "Person", name: article.author },
            datePublished: article.publishedAt.toISOString(),
            publisher: { "@type": "Organization", name: "ScholarAtlas" },
          }),
        }}
      />
    </article>
  );
}
