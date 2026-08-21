/**
 * Self-hosted photography (Unsplash License — free for commercial use, no
 * attribution required). Images live in /public/images so pages are served
 * entirely from the app's own CDN — no third-party hotlinks at render time.
 */
export const RESOURCE_IMAGES: Record<string, string> = {
  Scholarships: "/images/res-scholarships.jpg",
  "Study Abroad": "/images/res-abroad.jpg",
  Applications: "/images/res-applications.jpg",
};

export const RESOURCE_IMAGE_FALLBACK = "/images/res-guides.jpg";

export function resourceImage(category: string): string {
  return RESOURCE_IMAGES[category] ?? RESOURCE_IMAGE_FALLBACK;
}

/**
 * Photography for the homepage quick-category cards (Fully Funded, No IELTS,
 * …). Same licensing as above — self-hosted, served from the app's own CDN.
 */
export const QUICK_CATEGORY_IMAGES: Record<string, string> = {
  "fully-funded": "/images/cat-money.jpg",
  "no-ielts": "/images/res-guides.jpg",
  undergraduate: "/images/hero-campus.jpg",
  masters: "/images/hero-graduation.jpg",
  phd: "/images/cat-lab.jpg",
  "international-students": "/images/res-abroad.jpg",
  global: "/images/cat-globe.jpg",
  contests: "/images/cat-trophy.jpg",
  jobs: "/images/cat-office.jpg",
};

export const QUICK_CATEGORY_IMAGE_FALLBACK = "/images/res-scholarships.jpg";

export function quickCategoryImage(slug: string): string {
  return QUICK_CATEGORY_IMAGES[slug] ?? QUICK_CATEGORY_IMAGE_FALLBACK;
}
