import Link from "next/link";
import type { Scholarship } from "@prisma/client";
import { ArrowRight, CalendarDays, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UniversityLogo } from "./university-logo";
import { DeadlineBadge } from "./deadline-badge";
import { VerificationBadge } from "./verification-badge";
import { SaveButton } from "./save-button";
import { countryFlag, countryName, studyLevelFromSlug } from "@/lib/constants";
import { fieldsOf, hostCountriesOf, studyLevelsOf } from "@/lib/scholarship";
import { formatShortDate } from "@/lib/format";

interface CardProps {
  scholarship: Scholarship & { university?: { name: string; logoText: string | null; color: string | null } | null };
  saved?: boolean;
}

export function ScholarshipCardList({ scholarship: s, saved = false }: CardProps) {
  const levels = studyLevelsOf(s).slice(0, 3).map((slug) => studyLevelFromSlug(slug)).filter(Boolean);
  const isFullyFunded = s.fundingType === "FULLY_FUNDED" || s.fundingType === "FULLY_FUNDED_STIPEND";

  return (
    <article className="lift group flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
      <div className="flex items-center gap-3 sm:w-1/4">
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
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <span aria-hidden="true">{countryFlag(s.countryCode)}</span>
            {countryName(s.countryCode)}
            {hostCountriesOf(s).length > 0 && (
              <span aria-hidden="true" className="ml-1">
                {hostCountriesOf(s).map((c) => countryFlag(c)).join("")}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <Link href={`/scholarships/${s.slug}`}>
          <h3 className="font-display text-base font-bold leading-snug group-hover:text-primary">
            {s.title}
          </h3>
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {s.recordType === "JOB" && <Badge variant="outline">Job Listing</Badge>}
          {levels.map((level) => (
            <Badge key={level} variant="secondary">
              {level}
            </Badge>
          ))}
          {isFullyFunded && (
            <Badge variant="success">
              <Wallet className="h-3 w-3" />
              Fully Funded
            </Badge>
          )}
          {s.status === "EXPIRED" && <Badge variant="danger">Closed</Badge>}
          {s.verificationStatus === "VERIFIED" && <VerificationBadge status={s.verificationStatus} />}
        </div>
        {fieldsOf(s).length > 0 && (
          <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
            {fieldsOf(s).slice(0, 4).map((f) => f.replace(/-/g, " ")).join(" · ")}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4 sm:flex-col sm:items-end">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {s.status === "EXPIRED" ? "Closed" : s.deadline ? formatShortDate(s.deadline) : "Open / rolling"}
        </span>
        <DeadlineBadge scholarship={s} />
        <div className="flex items-center gap-2">
          <SaveButton scholarshipId={s.id} initialSaved={saved} />
          <Link
            href={`/scholarships/${s.slug}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            View
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
