import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { COUNTRIES, FIELDS, FIELD_GROUPS, QUICK_CATEGORIES } from "@/lib/constants";
import { getBaseUrl } from "@/lib/app-url";
import { CATALOGUE_TTL, cachedData } from "@/lib/data-cache";

// The base URL is resolved per-request (request host), which Next's static
// analysis can't see through the try/catch in getBaseUrl() — without this the
// sitemap would be prerendered at build time with a hardcoded fallback origin
// (and the build would depend on the DB being reachable).
export const dynamic = "force-dynamic";

// The sitemap's heavy work is reading ~11k rows (all universities + all ACTIVE
// scholarships). Catalogue data only changes on the weekly re-crawl, so the
// rows are cached across requests — the base URL stays per-request so the
// sitemap always advertises the domain that serves it. lastModified values are
// ISO strings (MetadataRoute.Sitemap accepts string | Date).
const getSitemapData = cachedData(
  ["sitemap-rows-v2"],
  async () => {
    const [countryScholarships, countryUniversities, universities, scholarships] = await Promise.all([
      prisma.scholarship.groupBy({
        by: ["countryCode"],
        where: { status: "ACTIVE", recordType: "SCHOLARSHIP" },
        _count: { _all: true },
      }),
      prisma.university.groupBy({
        by: ["countryCode"],
        _count: { _all: true },
      }),
      prisma.university.findMany({
        select: { slug: true, updatedAt: true },
        orderBy: { name: "asc" },
      }),
      prisma.scholarship.findMany({
        where: { status: "ACTIVE", recordType: "SCHOLARSHIP" },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    // Country pages — only countries that actually have data (same selection as
    // /countries; avoids sitemap entries that 404 or render an empty shell).
    const hasScholarships = new Set(countryScholarships.map((r) => r.countryCode));
    const hasUniversities = new Set(countryUniversities.map((r) => r.countryCode));
    const countryPaths = COUNTRIES.filter(
      (c) => hasScholarships.has(c.code) || hasUniversities.has(c.code)
    ).map((c) => `/countries/${c.code.toLowerCase()}`);

    return {
      universityPaths: universities.map((u) => ({
        path: `/universities/${u.slug}`,
        lastModified: u.updatedAt.toISOString(),
      })),
      scholarshipPaths: scholarships.map((s) => ({
        path: `/scholarships/${s.slug}`,
        lastModified: s.updatedAt.toISOString(),
      })),
      countryPaths,
    };
  },
  CATALOGUE_TTL
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Resolved per-request so the sitemap always advertises the domain that
  // serves it: NEXT_PUBLIC_APP_URL overrides, otherwise the request host.
  const baseUrl = await getBaseUrl();
  const url = (path: string) => `${baseUrl}${path}`;

  const data = await getSitemapData();

  // --- Static pages ---------------------------------------------------------
  const staticPages: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/scholarships"), changeFrequency: "daily", priority: 0.9 },
    { url: url("/contests"), changeFrequency: "weekly", priority: 0.5 },
    { url: url("/jobs"), changeFrequency: "weekly", priority: 0.5 },
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

  const countryPages: MetadataRoute.Sitemap = data.countryPaths.map((path) => ({
    url: url(path),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const universityPages: MetadataRoute.Sitemap = data.universityPaths.map((u) => ({
    url: url(u.path),
    lastModified: u.lastModified,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Active scholarship detail pages only (job listings and expired/closed
  // records are deliberately excluded — they shouldn't compete in search).
  const scholarshipPages: MetadataRoute.Sitemap = data.scholarshipPaths.map((s) => ({
    url: url(s.path),
    lastModified: s.lastModified,
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
