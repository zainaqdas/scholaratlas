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
