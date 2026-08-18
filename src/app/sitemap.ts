import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { COUNTRIES, FIELDS, FIELD_GROUPS, QUICK_CATEGORIES } from "@/lib/constants";

// Production origin — same fallback as layout.tsx so the sitemap never points
// at localhost in the deployment env.
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://scholaratlas.vercel.app";
const url = (path: string) => `${BASE}${path}`;

// Scholarship data refreshes on a weekly re-crawl — daily regeneration is more
// than enough for a sitemap.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // --- Static pages ---------------------------------------------------------
  const staticPages: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/scholarships"), changeFrequency: "daily", priority: 0.9 },
    { url: url("/countries"), changeFrequency: "daily", priority: 0.8 },
    { url: url("/universities"), changeFrequency: "daily", priority: 0.8 },
    { url: url("/fields"), changeFrequency: "daily", priority: 0.8 },
    { url: url("/deadlines"), changeFrequency: "daily", priority: 0.7 },
    { url: url("/resources"), changeFrequency: "weekly", priority: 0.6 },
    { url: url("/about"), changeFrequency: "monthly", priority: 0.4 },
    { url: url("/contact"), changeFrequency: "monthly", priority: 0.3 },
    { url: url("/faq"), changeFrequency: "monthly", priority: 0.3 },
    { url: url("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: url("/terms"), changeFrequency: "yearly", priority: 0.2 },
    { url: url("/disclaimer"), changeFrequency: "yearly", priority: 0.2 },
    { url: url("/submit-scholarship"), changeFrequency: "monthly", priority: 0.4 },
  ];

  // --- Static scholarship category pages (fully-funded, masters, phd…) ------
  const categoryPages: MetadataRoute.Sitemap = QUICK_CATEGORIES.map((c) => ({
    url: url(`/scholarships/${c.slug}`),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // --- Umbrella category landing pages (medicine-health, engineering…) ------
  const umbrellaPages: MetadataRoute.Sitemap = FIELD_GROUPS.map((g) => ({
    url: url(`/scholarships/${g.slug}`),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // --- Field pages (both leaf fields and broad groups) ----------------------
  const fieldPages: MetadataRoute.Sitemap = [
    ...FIELDS.map((f) => ({ slug: f.slug })),
    ...FIELD_GROUPS.map((g) => ({ slug: g.slug })),
  ].map(({ slug }) => ({
    url: url(`/fields/${slug}`),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // --- Country pages — only countries that actually have data ---------------
  // Same selection as the /countries page: a country is listed if it has an
  // ACTIVE scholarship or a linked university (avoids sitemap entries that 404
  // or render an empty shell).
  const [countryScholarships, countryUniversities] = await Promise.all([
    prisma.scholarship.groupBy({
      by: ["countryCode"],
      where: { status: "ACTIVE", recordType: "SCHOLARSHIP" },
      _count: { _all: true },
    }),
    prisma.university.groupBy({
      by: ["countryCode"],
      _count: { _all: true },
    }),
  ]);
  const hasScholarships = new Set(countryScholarships.map((r) => r.countryCode));
  const hasUniversities = new Set(countryUniversities.map((r) => r.countryCode));
  const countryPages: MetadataRoute.Sitemap = COUNTRIES.filter(
    (c) => hasScholarships.has(c.code) || hasUniversities.has(c.code)
  ).map((c) => ({
    url: url(`/countries/${c.code.toLowerCase()}`),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // --- University pages ------------------------------------------------------
  const universities = await prisma.university.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: { name: "asc" },
  });
  const universityPages: MetadataRoute.Sitemap = universities.map((u) => ({
    url: url(`/universities/${u.slug}`),
    lastModified: u.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // --- Active scholarship detail pages ---------------------------------------
  // Only ACTIVE SCHOLARSHIP records (job listings and expired/closed records
  // are deliberately excluded — they shouldn't compete in search results).
  const scholarships = await prisma.scholarship.findMany({
    where: { status: "ACTIVE", recordType: "SCHOLARSHIP" },
    select: { slug: true, updatedAt: true },
  });
  const scholarshipPages: MetadataRoute.Sitemap = scholarships.map((s) => ({
    url: url(`/scholarships/${s.slug}`),
    lastModified: s.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [
    ...staticPages,
    ...categoryPages,
    ...umbrellaPages,
    ...fieldPages,
    ...countryPages,
    ...universityPages,
    ...scholarshipPages,
  ];
}
