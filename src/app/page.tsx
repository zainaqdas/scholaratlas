import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Globe2,
  Landmark,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SearchBar } from "@/components/search-bar";
import { ScholarshipCard } from "@/components/scholarship/scholarship-card";
import { DeadlineBadge } from "@/components/scholarship/deadline-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  COUNTRIES,
  FIELDS,
  QUICK_CATEGORIES,
  countryFlag,
  countryName,
} from "@/lib/constants";
import { formatCount, relativeTime } from "@/lib/format";

const HERO_QUICK_FILTERS = [
  { label: "Fully Funded", href: "/scholarships?funding=FULLY_FUNDED,FULLY_FUNDED_STIPEND" },
  { label: "Undergraduate", href: "/scholarships?level=undergraduate" },
  { label: "Master's", href: "/scholarships?level=masters" },
  { label: "PhD", href: "/scholarships?level=phd" },
  { label: "No IELTS", href: "/scholarships?language=no-ielts" },
  { label: "International Students", href: "/scholarships?nationality=international" },
  { label: "Scholarships in USA", href: "/scholarships?country=US" },
  { label: "Scholarships in UK", href: "/scholarships?country=GB" },
  { label: "Scholarships in Europe", href: "/scholarships?country=DE,FR,NL,IT,ES,SE,CH,NO,DK,FI,IE,BE,AT,PT,PL" },
];

const FLOAT_CARDS = [
  { flag: "🇩🇪", text: "Germany", sub: "Fully Funded" },
  { flag: "🇯🇵", text: "Japan", sub: "PhD" },
  { flag: "🇨🇦", text: "Canada", sub: "Master's" },
  { flag: "🇬🇧", text: "UK", sub: "Undergraduate" },
];

async function getHomeData() {
  const [stats, featured, trending, recent, deadlines, universities, resources, topCountries] =
    await Promise.all([
      prisma.scholarship.count({ where: { status: "ACTIVE", recordType: "SCHOLARSHIP" } }),
      prisma.scholarship.findMany({
        where: { status: "ACTIVE", recordType: "SCHOLARSHIP", isFeatured: true },
        include: { university: true },
        take: 6,
      }),
      prisma.scholarship.findMany({
        where: { status: "ACTIVE", recordType: "SCHOLARSHIP", isTrending: true },
        include: { university: true },
        take: 6,
      }),
      prisma.scholarship.findMany({
        where: { status: "ACTIVE", recordType: "SCHOLARSHIP" },
        include: { university: true },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.scholarship.findMany({
        where: { status: "ACTIVE", recordType: "SCHOLARSHIP", deadline: { gte: new Date() } },
        orderBy: { deadline: "asc" },
        take: 8,
        include: { university: true },
      }),
      prisma.university.count(),
      prisma.article.findMany({ orderBy: { publishedAt: "desc" }, take: 3 }),
      prisma.scholarship.groupBy({
        by: ["countryCode"],
        where: { status: "ACTIVE", recordType: "SCHOLARSHIP" },
        _count: { _all: true },
        orderBy: { _count: { countryCode: "desc" } },
        take: 8,
      }),
    ]);

  const countryStats = new Map<string, number>();
  for (const c of topCountries) {
    if (c.countryCode) countryStats.set(c.countryCode, c._count._all);
  }

  return { stats, featured, trending, recent, deadlines, universities, resources, countryStats };
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getHomeData();
  const universityCount = data.universities;
  const countryCount = COUNTRIES.filter((c) => data.countryStats.has(c.code)).length;

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="hero-grid relative overflow-hidden">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-blue/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 top-40 h-80 w-80 rounded-full bg-brand-indigo/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8 lg:pb-24 lg:pt-20">
          <div>
            <Badge variant="secondary" className="mb-5 gap-1.5 px-3 py-1">
              <Globe2 className="h-3.5 w-3.5 text-primary" />
              {formatCount(data.stats)}+ opportunities across {countryCount} countries
            </Badge>
            <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Find Scholarships That Can{" "}
              <span className="text-gradient">Change Your Future</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Explore thousands of scholarships, fellowships, and fully funded opportunities from
              universities, governments, and organizations around the world.
            </p>

            <div className="mt-8">
              <SearchBar variant="hero" />
              <div className="mt-4 flex flex-wrap gap-2">
                {HERO_QUICK_FILTERS.map((f) => (
                  <Link
                    key={f.label}
                    href={f.href}
                    className="rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand-blue/40 hover:text-brand-blue"
                  >
                    {f.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Decorative world visual */}
          <div className="relative hidden lg:block" aria-hidden="true">
            <div className="relative mx-auto aspect-square max-w-md">
              <svg viewBox="0 0 400 400" className="h-full w-full">
                <defs>
                  <radialGradient id="globeGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--brand-blue)" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="var(--brand-blue)" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx="200" cy="200" r="170" fill="url(#globeGlow)" />
                <circle
                  cx="200"
                  cy="200"
                  r="120"
                  fill="none"
                  stroke="var(--brand-blue)"
                  strokeOpacity="0.25"
                  strokeWidth="1.5"
                />
                <ellipse
                  cx="200"
                  cy="200"
                  rx="120"
                  ry="42"
                  fill="none"
                  stroke="var(--brand-blue)"
                  strokeOpacity="0.18"
                  strokeWidth="1.5"
                />
                <ellipse
                  cx="200"
                  cy="200"
                  rx="42"
                  ry="120"
                  fill="none"
                  stroke="var(--brand-indigo)"
                  strokeOpacity="0.18"
                  strokeWidth="1.5"
                />
                {/* connection points */}
                {[
                  [120, 110], [270, 90], [300, 210], [250, 300], [120, 280], [90, 200],
                ].map(([x, y], i) => (
                  <g key={i}>
                    <circle cx={x} cy={y} r="5" fill="var(--brand-blue)" opacity="0.7" />
                    <circle cx={x} cy={y} r="11" fill="var(--brand-blue)" opacity="0.15">
                      <animate attributeName="r" values="8;14;8" dur="3s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.25;0.05;0.25" dur="3s" repeatCount="indefinite" />
                    </circle>
                  </g>
                ))}
                {[
                  [120, 110, 300, 90],
                  [300, 90, 300, 210],
                  [300, 210, 250, 300],
                  [250, 300, 120, 280],
                  [120, 280, 90, 200],
                  [90, 200, 120, 110],
                ].map(([x1, y1, x2, y2], i) => (
                  <line
                    key={`l${i}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="var(--brand-indigo)"
                    strokeOpacity="0.25"
                    strokeWidth="1"
                    strokeDasharray="3 4"
                  />
                ))}
              </svg>
              {FLOAT_CARDS.map((card, i) => (
                <div
                  key={card.text}
                  className="absolute rounded-2xl border bg-card/95 p-3 shadow-lg"
                  style={{
                    top: `${[12, 62, 68, 18][i]}%`,
                    left: `${[62, 58, 6, 8][i]}%`,
                  }}
                >
                  <p className="text-sm font-bold">{card.flag} {card.text}</p>
                  <p className="text-xs text-muted-foreground">{card.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Quick categories */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={cat.href}
              className="lift group flex items-start gap-4 rounded-2xl border bg-card p-5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue/15 to-brand-indigo/15 text-xl">
                {cat.icon}
              </span>
              <div>
                <h3 className="font-display font-bold leading-snug group-hover:text-primary">
                  {cat.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{cat.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- Stats strip */}
      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { value: formatCount(data.stats), label: "Scholarships" },
            { value: `${countryCount}+`, label: "Countries" },
            { value: `${universityCount}+`, label: "Universities" },
            { value: "50K+", label: "Students Helped" },
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
          Live counts from the ScholarAtlas database (demo data).
        </p>
      </section>

      {/* ------------------------------------------------ Featured opportunities */}
      <SectionShell
        id="featured"
        title="Featured Opportunities"
        subtitle="Hand-picked, verified scholarships from trusted providers."
        action={{ href: "/scholarships?featured=1", label: "View all featured" }}
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.featured.map((s) => (
            <ScholarshipCard key={s.id} scholarship={s} />
          ))}
        </div>
      </SectionShell>

      {/* ----------------------------------------------------- Trending section */}
      <section className="bg-card/60">
        <SectionShell
          id="trending"
          title={
            <span className="inline-flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Trending This Week
            </span>
          }
          subtitle="Ranked by views, saves and recency — updated automatically."
          action={{ href: "/scholarships?sort=popular", label: "Most popular" }}
          inset={false}
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.trending.map((s) => (
              <ScholarshipCard key={s.id} scholarship={s} />
            ))}
          </div>
        </SectionShell>
      </section>

      {/* --------------------------------------------------- Explore by country */}
      <SectionShell
        id="countries"
        title="Explore Scholarships by Country"
        subtitle="From fully funded government programmes to university awards."
        action={{ href: "/countries", label: "All countries" }}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[...data.countryStats.entries()].map(([code, count]) => (
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

      {/* ----------------------------------------------------- Explore by field */}
      <section className="bg-card/60">
        <SectionShell
          id="fields"
          title="Explore by Field of Study"
          subtitle="Whatever you want to study, there's funding out there."
          action={{ href: "/fields", label: "All fields" }}
          inset={false}
        >
          <div className="flex flex-wrap gap-2.5">
            {FIELDS.slice(0, 18).map((f) => (
              <Link
                key={f.slug}
                href={`/fields/${f.slug}`}
                className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-brand-blue/40 hover:text-brand-blue"
              >
                <span aria-hidden="true">{f.icon}</span>
                {f.name}
              </Link>
            ))}
          </div>
        </SectionShell>
      </section>

      {/* --------------------------------------------------------- Deadlines */}
      <SectionShell
        id="deadlines"
        title={
          <span className="inline-flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Closing Soon
          </span>
        }
        subtitle="Don't miss a deadline — these opportunities close first."
        action={{ href: "/deadlines", label: "All deadlines" }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {data.deadlines.map((s) => (
            <Link
              key={s.id}
              href={`/scholarships/${s.slug}`}
              className="lift flex items-center justify-between gap-4 rounded-2xl border bg-card p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{s.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {countryFlag(s.countryCode)} {countryName(s.countryCode)} · {s.provider}
                </p>
              </div>
              <DeadlineBadge scholarship={s} className="shrink-0" />
            </Link>
          ))}
        </div>
      </SectionShell>

      {/* -------------------------------------------------------- How it works */}
      <section className="bg-card/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">How It Works</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              From "what should I study?" to "where do I apply?" — in three steps.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                n: "01",
                icon: <Search className="h-6 w-6" />,
                title: "Search",
                text: "Tell us what you want to study and where.",
              },
              {
                n: "02",
                icon: <Sparkles className="h-6 w-6" />,
                title: "Discover",
                text: "Compare scholarships that match your goals.",
              },
              {
                n: "03",
                icon: <BadgeCheck className="h-6 w-6" />,
                title: "Apply",
                text: "Follow the official application instructions.",
              },
            ].map((step) => (
              <div key={step.n} className="relative rounded-2xl border bg-card p-7">
                <span className="absolute right-5 top-4 font-display text-4xl font-extrabold text-muted/60">
                  {step.n}
                </span>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-brand-indigo text-white">
                  {step.icon}
                </span>
                <h3 className="mt-4 font-display text-lg font-bold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild size="lg" className="gap-2">
              <Link href="/scholarships">
                Start Searching
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

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

      {/* ------------------------------------------------------ Recent + resources */}
      <section className="border-t bg-card/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-2xl font-extrabold tracking-tight">Recently Added</h2>
              <p className="mt-1 text-sm text-muted-foreground">The latest opportunities in the catalogue.</p>
              <div className="mt-6 space-y-3">
                {data.recent.map((s) => (
                  <Link
                    key={s.id}
                    href={`/scholarships/${s.slug}`}
                    className="lift flex items-center justify-between gap-4 rounded-2xl border bg-card p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{s.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {countryFlag(s.countryCode)} {countryName(s.countryCode)} · Added{" "}
                        {relativeTime(s.createdAt)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-display text-2xl font-extrabold tracking-tight">Latest Resources</h2>
              <p className="mt-1 text-sm text-muted-foreground">Guides to help you apply with confidence.</p>
              <div className="mt-6 space-y-3">
                {data.resources.map((a) => (
                  <Link
                    key={a.id}
                    href={`/resources/${a.slug}`}
                    className="lift block rounded-2xl border bg-card p-5"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{a.category}</Badge>
                      <span className="text-xs text-muted-foreground">{a.readingTime} min read</span>
                    </div>
                    <h3 className="mt-2.5 font-semibold leading-snug">{a.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- CTA */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-navy via-brand-blue/90 to-brand-indigo" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Education Shouldn't Be Limited by Borders
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100">
            Join thousands of students discovering opportunities that fit their goals — and take the
            first step toward your future today.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary" className="gap-2 bg-white text-brand-navy hover:bg-blue-50">
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
    </>
  );
}

function SectionShell({
  id,
  title,
  subtitle,
  action,
  children,
  inset = true,
}: {
  id: string;
  title: React.ReactNode;
  subtitle?: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  inset?: boolean;
}) {
  return (
    <section id={id} className={inset ? "" : ""}>
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
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
