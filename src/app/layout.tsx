import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AiAssistant } from "@/components/ai-assistant";
import { Analytics } from "@/components/analytics";
import { CookieConsent } from "@/components/cookie-consent";
import { RouteProgress } from "@/components/route-progress";
import { getStaticBaseUrl } from "@/lib/app-url";
import { APP_NAME, TAGLINE } from "@/lib/constants";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

// metadataBase must be absolute and is used to resolve the relative canonical/
// OG URLs each page emits. getStaticBaseUrl() resolves it from configuration
// (NEXT_PUBLIC_APP_URL ?? fallback) rather than request headers — reading
// headers() in the layout would opt every page out of the static HTML cache
// that keeps DB reads near zero. Set NEXT_PUBLIC_APP_URL when a canonical
// domain is added; sitemap/robots remain request-host aware (dynamic).
export function generateMetadata(): Metadata {
  const baseUrl = getStaticBaseUrl();
  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: `${APP_NAME} — ${TAGLINE}`,
      template: `%s · ${APP_NAME}`,
    },
    description:
      "Discover scholarships, fellowships and fully funded opportunities from universities, governments and organizations around the world.",
    keywords: ["scholarships", "study abroad", "fully funded", "masters scholarships", "phd funding", "international students"],
    openGraph: {
      type: "website",
      siteName: APP_NAME,
      title: `${APP_NAME} — ${TAGLINE}`,
      description: "Your world of scholarships, in one place.",
    },
    twitter: {
      card: "summary_large_image",
      title: `${APP_NAME} — ${TAGLINE}`,
      description: "Your world of scholarships, in one place.",
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0b1b3d" },
    { media: "(prefers-color-scheme: dark)", color: "#0a101f" },
  ],
};

const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('sa-theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fraunces.variable} ${manrope.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <RouteProgress />
        <SiteHeader />
        <main className="flex-1 page-enter">{children}</main>
        <SiteFooter />
        <CookieConsent />
        <Analytics />
        <AiAssistant />
      </body>
    </html>
  );
}
