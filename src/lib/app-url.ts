import { headers } from "next/headers";

// Last-resort origin — only used when NEXT_PUBLIC_APP_URL is unset AND the
// request host cannot be read (e.g. build-time prerendering). Never points at
// localhost so deployed pages never emit localhost URLs.
const FALLBACK_ORIGIN = "https://scholaratlas.vercel.app";

/**
 * Absolute base URL of the site, resolved in this order:
 *
 * 1. `NEXT_PUBLIC_APP_URL` — explicit override. Set this to the *canonical*
 *    domain when the site is reachable at several hosts (e.g. a custom domain
 *    alongside the Vercel URL) so every page emits one consistent origin.
 * 2. The incoming request's host — the site is domain-agnostic: canonicals,
 *    OG URLs, JSON-LD, sitemap and robots automatically use whatever domain
 *    serves the request, so moving to a new domain or a different server needs
 *    zero code changes and no environment configuration.
 * 3. FALLBACK_ORIGIN — safety net for contexts with no request.
 */
export async function getBaseUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      return `${proto}://${host}`;
    }
  } catch {
    // headers() throws outside a request context (build-time prerender).
  }

  return FALLBACK_ORIGIN;
}

/**
 * Sync base URL for statically-cached pages (ISR). Calling `headers()` inside
 * a page opts it out of the data/HTML cache, so cached pages resolve the
 * origin from configuration instead: NEXT_PUBLIC_APP_URL (set this when a
 * canonical domain is added) or the fallback. Sitemap/robots stay fully
 * request-host aware (they remain dynamic), and the search page stays dynamic.
 */
export function getStaticBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  return configured ? configured.replace(/\/+$/, "") : FALLBACK_ORIGIN;
}
