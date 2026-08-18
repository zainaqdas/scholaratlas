import Link from "next/link";
import type { Scholarship } from "@prisma/client";
import { ArrowRight, CalendarDays, Landmark, Layers, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UniversityLogo } from "./university-logo";
import { DeadlineBadge } from "./deadline-badge";
import { VerificationBadge } from "./verification-badge";
import { SaveButton } from "./save-button";
import { countryFlag, countryName, fundingLabel, studyLevelFromSlug } from "@/lib/constants";
import { fieldsOf, hasNoIelts, hostCountriesOf, studyLevelsOf } from "@/lib/scholarship";
import { formatShortDate } from "@/lib/format";

interface CardProps {
  scholarship: Scholarship & { university?: { name: string; logoText: string | null; color: string | null } | null };
  saved?: boolean;
}

export function ScholarshipCard({ scholarship: s, saved = false }: CardProps) {
  const levels = studyLevelsOf(s).slice(0, 2).map((slug) => studyLevelFromSlug(slug)).filter(Boolean);
  const fields = fieldsOf(s);
  const hostCountries = hostCountriesOf(s);
  const isFullyFunded = s.fundingType === "FULLY_FUNDED" || s.fundingType === "FULLY_FUNDED_STIPEND";
  // "International" = open to applicants of any nationality (["ALL"]), which is
  // what the "Scholarships for International Students" category page filters on.
  // Records restricted to specific nationalities (e.g. ["US"]) are NOT labelled
  // "International" — that would be misleading.
  const international = s.eligibleNationalities.includes('["ALL"]');

  return (
    <article className="lift group flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <UniversityLogo
            text={s.university?.logoText ?? null}
            color={s.university?.color ?? null}
            name={s.university?.name ?? s.provider}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted-foreground">
              {s.university?.name ?? s.provider}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <span aria-hidden="true">
                {hostCountries.length ? hostCountries.map((c) => countryFlag(c)).join("") : countryFlag(s.countryCode)}
              </span>
              {hostCountries.length ? `Multiple countries (${hostCountries.length})` : countryName(s.countryCode)}
            </p>
          </div>
        </div>
        <SaveButton scholarshipId={s.id} initialSaved={saved} />
      </div>

      <Link href={`/scholarships/${s.slug}`} className="mt-4 flex-1">
        <h3 className="font-display text-base font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
          {s.title}
        </h3>
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {s.recordType === "JOB" && <Badge variant="outline">Job Listing</Badge>}
        {levels.slice(0, 2).map((level) => (
          <Badge key={level} variant="secondary">
            <Layers className="h-3 w-3" />
            {level}
          </Badge>
        ))}
        {s.status === "EXPIRED" && <Badge variant="danger">Closed</Badge>}
        {isFullyFunded && (
          <Badge variant="success">
            <Wallet className="h-3 w-3" />
            Fully Funded
          </Badge>
        )}
        {hasNoIelts(s) && <Badge variant="info">No IELTS</Badge>}
        {s.verificationStatus === "VERIFIED" && <VerificationBadge status={s.verificationStatus} />}
        {international && <Badge variant="accent">International</Badge>}
      </div>

      {fields.length > 0 && (
        <p className="mt-3 line-clamp-1 text-xs text-muted-foreground">
          <Landmark className="mr-1 inline h-3 w-3" />
          {fields.slice(0, 3).map((f) => f.replace(/-/g, " ")).join(" · ")}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between border-t pt-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {s.status === "EXPIRED" ? "Closed" : s.deadline ? formatShortDate(s.deadline) : "Open / rolling"}
        </div>
        <DeadlineBadge scholarship={s} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {s.amount ? `≈ ${s.amount}` : fundingLabel(s.fundingType)}
        </span>
        <Link
          href={`/scholarships/${s.slug}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          View Scholarship
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}
