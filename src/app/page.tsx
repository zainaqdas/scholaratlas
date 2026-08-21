import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle2, Globe2, ShieldCheck } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QUICK_CATEGORIES, countryFlag, countryName } from "@/lib/constants";
import { formatCount } from "@/lib/format";
import { HOMEPAGE_TTL, cachedData } from "@/lib/data-cache";
import { withOpenDeadline } from "@/lib/scholarship";
import { quickCategoryImage } from "@/lib/images";

const FLOAT_CARDS = [
  { code: "DE", text: "Germany", sub: "Fully Funded" },
  { code: "JP", text: "Japan", sub: "PhD" },
  { code: "CA", text: "Canada", sub: "Master's" },
  { code: "GB", text: "UK", sub: "Undergraduate" },
];

const getHomeData = cachedData(
  ["homepage-data-v7"],
  async () => {
    const [stats, universities, activeDeadlines, allCountryRows] = await Promise.all([
      prisma.scholarship.count({ where: withOpenDeadline({ status: "ACTIVE", recordType: "SCHOLARSHIP" }) }),
      prisma.university.count(),
      prisma.scholarship.count({
        where: { status: "ACTIVE", recordType: "SCHOLARSHIP", deadline: { gte: new Date() } },
      }),
      // countryCode + host list for every ACTIVE scholarship — a record can
      // belong to several countries via hostCountries (SEARCA → ID/MY/TH/PH),
      // so the top-country grid and the distinct-country count are tallied in JS.
      prisma.scholarship.findMany({
        where: withOpenDeadline({ status: "ACTIVE", recordType: "SCHOLARSHIP" }),
        select: { countryCode: true, hostCountries: true },
      }),
    ]);

    // Tallies include hostCountries: a multi-country programme counts toward
    // every country it lists (SEARCA counts toward ID/MY/TH/PH as well as being
    // in the Global category).
    const countryStatsAll: Record<string, number> = {};
    const countrySet = new Set<string>();
    for (const s of allCountryRows) {
      const codes = new Set<string>();
      if (s.countryCode) codes.add(s.countryCode);
      try {
        for (const c of JSON.parse(s.hostCountries) as string[]) codes.add(c);
      } catch {
        // ignore malformed JSON
      }
      for (const code of codes) {
        countrySet.add(code);
        countryStatsAll[code] = (countryStatsAll[code] ?? 0) + 1;
      }
    }
    const countryStats: Record<string, number> = Object.fromEntries(
      Object.entries(countryStatsAll).sort((a, b) => b[1] - a[1]).slice(0, 8)
    );
    // Distinct destination countries with at least one active scholarship
    const countryCount = countrySet.size;
    // Multi-country programmes with no single host country (Global category)
    const globalCount = allCountryRows.filter((r) => !r.countryCode).length;

    return {
      stats,
      universities,
      activeDeadlines,
      countryStats,
      countryCount,
      globalCount,
    };
  },
  HOMEPAGE_TTL
);

// ISR: the homepage HTML is cached for an hour on the CDN; its heavy aggregate
// data is separately cached (homepage-data-v7). Visitors and crawlers hit the
// cached page instead of the DB.
export const revalidate = 3600;

export default async function HomePage() {
  const data = await getHomeData();
  const universityCount = data.universities;
  const countryCount = data.countryCount;

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="hero-ink grain relative overflow-hidden">
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8 lg:pb-24 lg:pt-20">
          <div className="stagger">
            <Badge className="mb-5 gap-1.5 border-brand-gold/30 bg-brand-gold/10 px-3 py-1 text-accent dark:text-brand-gold">
              <Globe2 className="h-3.5 w-3.5" />
              {formatCount(data.stats)}+ opportunities across {countryCount} countries
            </Badge>
            <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-5xl xl:text-6xl">
              Find Scholarships That Can{" "}
              <span className="text-gradient">Change Your Future</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Explore thousands of scholarships, fellowships, and fully funded opportunities from
              universities, governments, and organizations around the world.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link href="/scholarships">
                  Browse Scholarships
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/fields">Explore by Field</Link>
              </Button>
            </div>
          </div>

          {/* Hero visual — real photography */}
          <div className="relative hidden lg:block">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-md">
              {/* Main photo */}
              <div className="absolute inset-0 overflow-hidden rounded-[1.75rem] shadow-2xl ring-1 ring-black/10">
                <Image
                  src="/images/hero-students.jpg"
                  alt="Students collaborating on a scholarship application"
                  fill
                  priority
                  sizes="(min-width: 1024px) 40vw, 0vw"
                  className="object-cover"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent"
                  aria-hidden="true"
                />
              </div>

              {/* Secondary photo */}
              <div className="absolute -bottom-10 -left-8 w-44 overflow-hidden rounded-2xl shadow-xl ring-4 ring-card">
                <div className="aspect-[3/2]">
                  <Image
                    src="/images/hero-graduation.jpg"
                    alt="Graduates celebrating"
                    fill
                    sizes="176px"
                    className="object-cover"
                  />
                </div>
              </div>

              {/* Floating country cards */}
              {FLOAT_CARDS.map((card, i) => (
                <div
                  key={card.text}
                  className="absolute flex items-center gap-2.5 rounded-2xl border border-brand-gold/25 bg-card/95 p-3 pr-4 shadow-xl backdrop-blur"
                  style={{
                    top: `${[6, 78, 44, 5][i]}%`,
                    left: `${[54, 50, -2, -2][i]}%`,
                  }}
                  aria-hidden="true"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-amber-600 font-display text-sm font-bold text-white">
                    {card.code}
                  </span>
                  <span>
                    <p className="text-sm font-bold">{card.text}</p>
                    <p className="text-xs text-muted-foreground">{card.sub}</p>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Quick categories */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="reveal-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Contests lives at /contests (not under /scholarships/), so it is
              appended here rather than added to QUICK_CATEGORIES — the sitemap
              derives /scholarships/{slug} from that list. */}
          {[
            ...QUICK_CATEGORIES,
            {
              slug: "contests",
              title: "Contests & Prizes",
              description: "Competitions, awards and prize opportunities.",
              href: "/contests",
            },
            {
              slug: "jobs",
              title: "Jobs & Positions",
              description: "PhD positions, postdocs and research roles.",
              href: "/jobs",
            },
          ].map((cat) => (
            <Link
              key={cat.slug}
              href={cat.href}
              className="reveal-on-scroll lift group relative flex min-h-[11rem] flex-col justify-end overflow-hidden rounded-2xl border bg-card p-5 shadow-sm"
            >
              <Image
                src={quickCategoryImage(cat.slug)}
                alt=""
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15 transition-colors duration-300 group-hover:from-black/90"
                aria-hidden="true"
              />
              <div className="relative flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-inset ring-white/30 backdrop-blur transition-transform duration-200 group-hover:scale-110">
                  <CategoryIcon slug={cat.slug} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display font-bold leading-snug text-white">
                    {cat.title}
                  </h3>
                  <p className="mt-1 text-sm text-white/75">{cat.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------- Explore by country */}
      <SectionShell
        id="countries"
        title="Explore Scholarships by Country"
        subtitle="From fully funded government programmes to university awards."
        action={{ href: "/countries", label: "All countries" }}
        reveal
        band
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.globalCount > 0 && (
            <Link
              href="/scholarships/global"
              className="lift flex items-center gap-3 rounded-2xl border bg-card p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-indigo/15 to-brand-cyan/10 text-brand-indigo ring-1 ring-inset ring-brand-indigo/20">
                <Globe2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">Global &amp; Multi-Country</p>
                <p className="text-xs text-muted-foreground">{data.globalCount} scholarships</p>
              </div>
            </Link>
          )}
          {Object.entries(data.countryStats).map(([code, count]) => (
            <Link
              key={code}
              href={`/countries/${code.toLowerCase()}`}
              className="lift flex items-center gap-3 rounded-2xl border bg-card p-4"
            >
              <span className="text-2xl" aria-hidden="true">
                {countryFlag(code)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{countryName(code)}</p>
                <p className="text-xs text-muted-foreground">{count} scholarships</p>
              </div>
            </Link>
          ))}
        </div>
      </SectionShell>

      {/* ------------------------------------------------------------- Trust */}
      <SectionShell
        id="trust"
        title={
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Scholarships You Can Trust
          </span>
        }
        subtitle="We take data quality seriously — but always verify before you apply."
        reveal
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Sourced from official providers",
              text: "Information is sourced from official providers where possible, with source links preserved.",
            },
            {
              title: "Regularly reviewed",
              text: "Scholarship data is regularly reviewed and deadlines are monitored by our team.",
            },
            {
              title: "You can report errors",
              text: "Spot something wrong? Report it and our moderation team will review the listing.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border bg-card p-5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="mt-3 font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ScholarAtlas does not guarantee admission or scholarship awards. Always verify eligibility
          with the official provider.{" "}
          <Link href="/disclaimer" className="font-medium text-primary hover:underline">
            Learn more
          </Link>
        </p>
      </SectionShell>

      {/* ---------------------------------------------------------------- CTA */}
      <section className="reveal-on-scroll relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-navy via-brand-blue/90 to-brand-indigo" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Education Shouldn&apos;t Be Limited by Borders
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/75">
            Join thousands of students discovering opportunities that fit their goals — and take the
            first step toward your future today.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-2 bg-brand-gold text-brand-navy shadow-lg shadow-brand-gold/25 hover:brightness-110">
              <Link href="/scholarships">
                Find Your Scholarship
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="gap-2 text-white hover:bg-white/10">
              <Link href="/about">How ScholarAtlas Works</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Live stats strip */}
      <section className="reveal-on-scroll border-y bg-card">
        <div>
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
            {[
              { value: formatCount(data.stats), label: "Scholarships" },
              { value: `${countryCount}+`, label: "Countries" },
              { value: `${universityCount}+`, label: "Universities" },
              { value: formatCount(data.activeDeadlines), label: "Active Deadlines" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-display text-3xl font-extrabold tracking-tight text-gradient sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
          <p className="pb-4 text-center text-xs text-muted-foreground">
            Live counts from the ScholarAtlas database.
          </p>
        </div>
      </section>
    </>
  );
}

function SectionShell({
  id,
  title,
  subtitle,
  action,
  children,
  reveal = false,
  band = false,
}: {
  id: string;
  title: React.ReactNode;
  subtitle?: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  reveal?: boolean;
  band?: boolean;
}) {
  return (
    // `band` gives the section its own full-width canvas (raised background +
    // top/bottom border edges) so adjacent sections read as separate blocks
    // and the scroll reveal is obvious. When banded, the reveal animates the
    // whole band — background and border included.
    <section
      id={id}
      className={`${band ? "border-y border-border/60 bg-card/40" : ""}${reveal && band ? " reveal-on-scroll" : ""}`}
    >
      <div
        className={`mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8${reveal && !band ? " reveal-on-scroll" : ""}`}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
            {subtitle && <p className="mt-2 max-w-2xl text-muted-foreground">{subtitle}</p>}
          </div>
          {action && (
            <Link
              href={action.href}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              {action.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}
