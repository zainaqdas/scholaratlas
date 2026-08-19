import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bookmark } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { countryFlag, countryName } from "@/lib/constants";
import { LiveDeadlineBadge, LiveDeadlineDot } from "@/components/scholarship/live-deadline-badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { RemoveSavedButton } from "@/components/dashboard/remove-saved-button";

export const metadata: Metadata = { title: "My Saved Scholarships", robots: { index: false } };

export default async function SavedPage() {
  const user = await requireUser("/saved");

  const saved = await prisma.savedScholarship.findMany({
    where: { userId: user.id },
    include: {
      scholarship: { include: { university: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue to-brand-indigo text-white">
          <Bookmark className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">My Saved Scholarships</h1>
          <p className="mt-1 text-muted-foreground">
            {saved.length === 0
              ? "Save scholarships to track deadlines and compare opportunities."
              : `${saved.length} saved ${saved.length === 1 ? "scholarship" : "scholarships"}`}
          </p>
        </div>
      </div>

      {saved.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No Saved Scholarships"
            description="You haven't saved any scholarships yet. Explore the catalogue and bookmark opportunities you're interested in."
            action={{ label: "Explore Scholarships", href: "/scholarships" }}
          />
        </div>
      ) : (
        <ul className="mt-8 divide-y rounded-2xl border bg-card">
          {saved.map(({ scholarship: s }) => {
            const expired = s.status === "EXPIRED" || (s.deadline && s.deadline < new Date());
            return (
              <li key={s.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/scholarships/${s.slug}`} className="font-semibold leading-snug hover:text-primary">
                    {s.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {countryFlag(s.countryCode)} {countryName(s.countryCode)} · {s.provider}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <LiveDeadlineDot scholarship={s} />
                      {expired ? "Closed" : "Deadline"}
                    </span>
                    <LiveDeadlineBadge scholarship={s} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/scholarships/${s.slug}`}>
                      View
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <RemoveSavedButton scholarshipId={s.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
