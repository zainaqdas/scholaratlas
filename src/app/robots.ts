import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/app-url";

// Per-request host resolution (same reasoning as sitemap.ts) — keeps the
// robots file domain-aware and off the build-time DB path.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await getBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
