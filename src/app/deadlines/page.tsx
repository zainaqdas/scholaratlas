import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { countryFlag, countryName } from "@/lib/constants";
import { LiveDeadlineBadge, LiveDeadlineLabel } from "@/components/scholarship/live-deadline-badge";

// ISR 6h: the page's "now"-based buckets (this week / this month) must refresh
// as deadlines pass, but the data only changes on the weekly re-crawl — so a
// 6h re-render keeps the buckets honest without per-request DB reads.
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Scholarship Deadlines",
  description:
    "Track scholarship application deadlines — closing this week, this month, and upcoming opportunities with live countdowns.",
  alternates: { canonical: "/deadlines" },
};

export default async function DeadlinesPage() {
  const now = new Date();
  const addDays = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  const upcoming = await prisma.scholarship.findMany({
    where: { status: "ACTIVE", recordType: "SCHOLARSHIP", deadline: { gte: now } },
    include: { university: true },
    orderBy: { deadline: "asc" },
    take: 60,
  });

  const week = upcoming.filter((s) => s.deadline && s.deadline <= addDays(7));
  const month = upcoming.filter(
    (s) => s.deadline && s.deadline > addDays(7) && s.deadline <= addDays(30)
  );
  const rest = upcoming.filter((s) => !s.deadline || s.deadline > addDays(30));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue to-brand-indigo text-white">
          <CalendarClock className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Scholarship Deadlines</h1>
          <p className="mt-1 text-muted-foreground">
            Countdowns are calculated from actual deadline timestamps.
          </p>
        </div>
      </div>

      <DeadlineSection title="Closing This Week" items={week} tone="red" />
      <DeadlineSection title="Closing This Month" items={month} tone="amber" />
      <DeadlineSection title="Upcoming" items={rest} tone="slate" />

      {upcoming.length === 0 && (
        <p className="mt-10 rounded-xl border border-dashed bg-card p-10 text-center text-muted-foreground">
          No upcoming deadlines right now.
        </p>
      )}
    </div>
  );
}

function DeadlineSection({
  title,
  items,
  tone,
}: {
  title: string;
  items: (Awaited<ReturnType<typeof prisma.scholarship.findMany>>)[number][];
  tone: "red" | "amber" | "slate";
}) {
  if (items.length === 0) return null;
  const dot = tone === "red" ? "bg-red-500" : tone === "amber" ? "bg-amber-500" : "bg-slate-400";

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />
        {title}
        <span className="text-sm font-medium text-muted-foreground">({items.length})</span>
      </h2>
      <ul className="mt-4 divide-y rounded-2xl border bg-card">
        {items.map((s) => {
          return (
            <li key={s.id}>
              <Link
                href={`/scholarships/${s.slug}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {countryFlag(s.countryCode)} {countryName(s.countryCode)} · {s.provider}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <LiveDeadlineLabel
                    deadline={s.deadline}
                    className="hidden text-xs text-muted-foreground sm:inline"
                  />
                  <LiveDeadlineBadge scholarship={s} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
