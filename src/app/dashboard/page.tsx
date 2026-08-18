import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bookmark, CalendarClock, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { matchScholarship } from "@/lib/scholarship";
import { countryFlag, countryName, studyLevelFromSlug } from "@/lib/constants";
import { DeadlineBadge } from "@/components/scholarship/deadline-badge";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage() {
  const user = await requireUser();

  const [savedRows, recommended] = await Promise.all([
    prisma.savedScholarship.findMany({
      where: { userId: user.id },
      include: { scholarship: { include: { university: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.scholarship.findMany({
      where: { status: "ACTIVE", recordType: "SCHOLARSHIP" },
      include: { university: true },
      take: 60,
    }),
  ]);

  const saved = savedRows.map((r) => r.scholarship);
  const savedIds = new Set(saved.map((s) => s.id));

  const upcomingSaved = saved
    .filter((s) => s.deadline && s.deadline > new Date())
    .sort((a, b) => (a.deadline?.getTime() ?? 0) - (b.deadline?.getTime() ?? 0));

  const scored = recommended
    .map((s) => ({
      s,
      match: matchScholarship(s, {
        nationality: user.nationality,
        degreeLevel: user.degreeLevel,
        fieldOfStudy: user.fieldOfStudy,
        preferredDestination: user.preferredDestination,
      }),
    }))
    .filter(({ s: sch, match }) => match.score >= 55 && !savedIds.has(sch.id))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, 6);

  const hasProfile =
    user.nationality || user.degreeLevel || user.fieldOfStudy || user.preferredDestination;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Hi, {user.name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="mt-1 text-muted-foreground">
            Your personalized scholarship dashboard.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/scholarships">
            <Sparkles className="h-4 w-4" />
            Find Scholarships
          </Link>
        </Button>
      </div>

      {/* Stat cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Bookmark className="h-5 w-5" />}
          label="Saved scholarships"
          value={saved.length}
          href="/saved"
        />
        <StatCard
          icon={<CalendarClock className="h-5 w-5" />}
          label="Upcoming deadlines"
          value={upcomingSaved.length}
          href="/deadlines"
        />
        <StatCard
          icon={<Sparkles className="h-5 w-5" />}
          label="Recommendations"
          value={scored.length}
          href="#recommended"
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-10">
          {/* Recommendations */}
          <section id="recommended">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Scholarships For You</h2>
            </div>
            {!hasProfile ? (
              <div className="mt-4 rounded-2xl border border-dashed bg-card p-8 text-center">
                <p className="font-medium">Complete your profile to get personalized recommendations</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tell us your nationality, field and preferred destination — we&apos;ll match them
                  against the catalogue.
                </p>
              </div>
            ) : scored.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No strong matches found yet. Update your profile below or explore the catalogue.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {scored.map(({ s, match }) => (
                  <li key={s.id} className="rounded-2xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/scholarships/${s.slug}`} className="font-semibold leading-snug hover:text-primary">
                        {s.title}
                      </Link>
                      <Badge variant={match.score >= 80 ? "success" : "info"}>{match.score}% Match</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {countryFlag(s.countryCode)} {countryName(s.countryCode)} · {s.provider}
                    </p>
                    {match.reasons.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                        {match.reasons.map((r) => (
                          <li key={r} className="text-xs text-emerald-700 dark:text-emerald-400">✓ {r}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Based on the information in your profile, these appear to be strong matches. Always
              verify eligibility with the official provider.
            </p>
          </section>

          {/* Upcoming deadlines from saved */}
          {upcomingSaved.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold">Upcoming Deadlines</h2>
              <ul className="mt-4 space-y-2">
                {upcomingSaved.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
                    <Link href={`/scholarships/${s.slug}`} className="truncate text-sm font-medium hover:text-primary">
                      {s.title}
                    </Link>
                    <DeadlineBadge scholarship={s} className="shrink-0" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside>
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="font-display text-lg font-bold">My Profile</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Used for personalized recommendations only.
            </p>
            <div className="mt-5">
              <ProfileForm user={user} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} className="lift flex items-center gap-4 rounded-2xl border bg-card p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue/15 to-brand-indigo/15 text-primary">
        {icon}
      </span>
      <div>
        <p className="font-display text-2xl font-extrabold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
