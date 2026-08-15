import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Globe2,
  GraduationCap,
  Landmark,
  Languages,
  Layers,
  ListChecks,
  MapPin,
  ShieldAlert,
  Users,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScholarshipCard } from "@/components/scholarship/scholarship-card";
import { SaveButton } from "@/components/scholarship/save-button";
import { ShareButton } from "@/components/scholarship/share-button";
import { ReportDialog } from "@/components/scholarship/report-dialog";
import { ViewTracker } from "@/components/scholarship/view-tracker";
import { DeadlineBadge, DeadlineDot } from "@/components/scholarship/deadline-badge";
import { VerificationBadge } from "@/components/scholarship/verification-badge";
import { UniversityLogo } from "@/components/scholarship/university-logo";
import {
  BENEFITS,
  DOCUMENTS,
  DEFAULT_APPLICATION_STEPS,
  FUNDING_TYPES,
  PROVIDER_TYPES,
  countryFlag,
  countryName,
  studyLevelFromSlug,
} from "@/lib/constants";
import {
  benefitsOf,
  docsOf,
  eligibleOf,
  fieldsOf,
  hasNoIelts,
  isOpenToAll,
  languageOf,
  stepsOf,
  studyLevelNamesOf,
} from "@/lib/scholarship";
import { formatDateTime, formatDate, formatShortDate } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getScholarship(slug: string) {
  return prisma.scholarship.findUnique({
    where: { slug },
    include: { university: true, country: true },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const s = await getScholarship(slug);
  if (!s) return { title: "Scholarship not found" };

  const level = studyLevelNamesOf(s)[0] ?? "";
  const funding = FUNDING_TYPES.find((f) => f.value === s.fundingType)?.label ?? "";
  const title = `${s.title} — ${countryName(s.countryCode)} • ${level} • ${funding}`;

  return {
    title,
    description: s.description?.slice(0, 155) ?? `${s.title} at ${s.provider}. Deadline: ${formatShortDate(s.deadline)}.`,
    alternates: { canonical: `/scholarships/${s.slug}` },
    openGraph: {
      type: "website",
      title,
      description: `${countryName(s.countryCode)} • ${level} • ${funding}${s.deadline ? ` • Deadline: ${formatShortDate(s.deadline)}` : ""}`,
      url: `/scholarships/${s.slug}`,
    },
  };
}

export default async function ScholarshipDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const s = await getScholarship(slug);
  if (!s) notFound();

  const user = await getCurrentUser();
  const saved = user
    ? !!(await prisma.savedScholarship.findUnique({
        where: { userId_scholarshipId: { userId: user.id, scholarshipId: s.id } },
      }))
    : false;

  const similar = await prisma.scholarship.findMany({
    where: {
      status: "ACTIVE",
      id: { not: s.id },
      OR: [{ countryCode: s.countryCode }, { fundingType: s.fundingType }],
    },
    include: { university: true },
    take: 6,
  });

  const levels = studyLevelNamesOf(s);
  const fields = fieldsOf(s);
  const benefits = benefitsOf(s);
  const docs = docsOf(s);
  const steps = stepsOf(s) ?? DEFAULT_APPLICATION_STEPS;
  const lang = languageOf(s);
  const eligible = eligibleOf(s);
  const expired = s.status === "EXPIRED" || (s.deadline && s.deadline < new Date());

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <ViewTracker scholarshipId={s.id} />

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-primary">Home</Link>
          </li>
          <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
          <li>
            <Link href="/scholarships" className="hover:text-primary">Scholarships</Link>
          </li>
          <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
          <li aria-current="page" className="max-w-[16rem] truncate text-foreground">{s.title}</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {s.verificationStatus === "VERIFIED" && <VerificationBadge status={s.verificationStatus} />}
            {hasNoIelts(s) && <Badge variant="info">No IELTS</Badge>}
            {isOpenToAll(s) && <Badge variant="accent">Open to all nationalities</Badge>}
            {expired ? (
              <Badge variant="danger">Closed</Badge>
            ) : (
              <Badge variant="secondary">
                <DeadlineDot scholarship={s} />
                <span className="ml-1">Open</span>
              </Badge>
            )}
          </div>

          <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            {s.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              {s.provider}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {countryFlag(s.countryCode)} {countryName(s.countryCode)}
              {s.city ? `, ${s.city}` : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              Deadline: {s.deadline ? formatDateTime(s.deadline, s.deadlineTimezone ?? undefined) : "Open / rolling"}
            </span>
          </div>

          {s.description && (
            <p className="mt-6 leading-relaxed text-muted-foreground">{s.description}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button asChild size="lg" className="gap-2">
              <a href={s.officialUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Visit Official Scholarship Website
              </a>
            </Button>
            <SaveButton scholarshipId={s.id} initialSaved={saved} label className="h-12 px-5 text-sm" />
            <ShareButton title={s.title} />
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
            <Globe2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong>Apply Safely:</strong> Applications are processed on the official provider
              website — not on ScholarAtlas. Only apply through the official source linked above.
            </p>
          </div>
        </div>

        {/* Overview panel */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UniversityLogo
                text={s.university?.logoText ?? null}
                color={s.university?.color ?? null}
                name={s.university?.name ?? s.provider}
                size="sm"
              />
              <span>Scholarship Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <OverviewRow icon={<Building2 className="h-4 w-4" />} label="Provider" value={s.provider} />
            {s.university && (
              <OverviewRow
                icon={<Landmark className="h-4 w-4" />}
                label="Host Institution"
                value={
                  <Link href={`/universities/${s.university.slug}`} className="font-medium text-primary hover:underline">
                    {s.university.name}
                  </Link>
                }
              />
            )}
            <OverviewRow icon={<MapPin className="h-4 w-4" />} label="Host Country" value={`${countryFlag(s.countryCode)} ${countryName(s.countryCode)}`} />
            <OverviewRow icon={<Layers className="h-4 w-4" />} label="Study Level" value={levels.join(", ") || "Not specified"} />
            <OverviewRow icon={<GraduationCap className="h-4 w-4" />} label="Field of Study" value={fields.includes("ALL") ? "All fields" : fields.slice(0, 4).map((f) => f.replace(/-/g, " ")).join(", ") || "Not specified"} />
            <OverviewRow icon={<Wallet className="h-4 w-4" />} label="Funding Type" value={FUNDING_TYPES.find((f) => f.value === s.fundingType)?.label ?? s.fundingType} />
            <OverviewRow icon={<CircleDollarSign className="h-4 w-4" />} label="Value" value={s.amount || "Not specified"} />
            <OverviewRow icon={<Clock3 className="h-4 w-4" />} label="Duration" value={s.duration || "Not specified"} />
            <OverviewRow
              icon={<CalendarDays className="h-4 w-4" />}
              label="Application Deadline"
              value={
                <span className="inline-flex items-center gap-2">
                  {s.deadline ? formatShortDate(s.deadline) : "Open / rolling"}
                  <DeadlineBadge scholarship={s} />
                </span>
              }
            />
            <OverviewRow icon={<Users className="h-4 w-4" />} label="Eligible Nationalities" value={isOpenToAll(s) ? "All nationalities" : eligible.length > 8 ? `${eligible.length} countries` : eligible.map((c) => countryName(c)).join(", ")} />
            <OverviewRow icon={<CircleDollarSign className="h-4 w-4" />} label="Application Fee" value={s.applicationFee || "Free"} />
            <OverviewRow
              icon={<ExternalLink className="h-4 w-4" />}
              label="Official Website"
              value={
                <a href={s.officialUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                  {new URL(s.officialUrl).hostname}
                </a>
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* Funding details */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">What Does This Scholarship Cover?</h2>
        {benefits.length === 0 ? (
          <p className="mt-3 text-muted-foreground">
            Specific benefits are <strong>not specified</strong> for this scholarship. Check the
            official provider website for full details.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.filter((b) => benefits.includes(b.key)).map((b) => (
              <div key={b.key} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium">{b.icon} {b.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Eligibility */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Who Can Apply?</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <EligibilityCard
            icon={<Users className="h-5 w-5" />}
            title="Nationality"
            lines={isOpenToAll(s) ? ["Open to all nationalities"] : eligible.map((c) => `${countryFlag(c)} ${countryName(c)}`)}
          />
          <EligibilityCard
            icon={<GraduationCap className="h-5 w-5" />}
            title="Academic Requirements"
            lines={s.academicRequirements ? [s.academicRequirements] : ["Not specified — check the official provider."]}
          />
          <EligibilityCard
            icon={<Languages className="h-5 w-5" />}
            title="Language Requirements"
            lines={[
              lang.ielts ? "IELTS required" : null,
              lang.toefl ? "TOEFL required" : null,
              lang.noIelts ? "No IELTS required" : null,
              lang.altProof ? "Alternative English proof accepted" : null,
              lang.notRequired ? "English test not required" : null,
            ].filter(Boolean) as string[]}
          />
          <EligibilityCard
            icon={<Clock3 className="h-5 w-5" />}
            title="Age & Experience"
            lines={[
              s.ageRequirements ? `Age: ${s.ageRequirements}` : null,
              s.workExperience ? `Experience: ${s.workExperience}` : null,
            ].filter(Boolean) as string[]}
          />
        </div>
      </section>

      {/* Application process */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">How to Apply</h2>
        <ol className="mt-5 space-y-0">
          {steps.map((step, i) => (
            <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
              {i < steps.length - 1 && (
                <span className="absolute left-[15px] top-8 h-full w-px bg-border" aria-hidden="true" />
              )}
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-indigo text-sm font-bold text-white">
                {i + 1}
              </span>
              <div className="pt-1">
                <p className="font-medium">{step}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Required documents */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Required Documents</h2>
        {docs.length === 0 ? (
          <p className="mt-3 text-muted-foreground">
            Document list <strong>not specified</strong> — see the official application instructions.
          </p>
        ) : (
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {DOCUMENTS.filter((d) => docs.includes(d.key)).map((d) => (
              <li key={d.key} className="flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-2.5 text-sm">
                <ListChecks className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {d.label}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Warning / verification */}
      <section className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/40">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold">Before You Apply</h2>
            <p className="mt-1 text-sm leading-relaxed text-amber-900 dark:text-amber-200">
              Always verify the scholarship information on the official provider website.
              Scholarship deadlines, requirements, funding details, and eligibility can change.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-amber-900/80 dark:text-amber-200/80">
              <span>
                <strong>Last Verified:</strong> {s.lastVerifiedAt ? formatDate(s.lastVerifiedAt) : "Not recorded"}
              </span>
              <span>
                <strong>Source:</strong> Official Provider
              </span>
              <span>
                <strong>Verification Status:</strong> <VerificationBadge status={s.verificationStatus} />
              </span>
            </div>
            <div className="mt-4">
              <ReportDialog scholarshipId={s.id} />
            </div>
          </div>
        </div>
      </section>

      {/* Similar */}
      {similar.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-2xl font-extrabold tracking-tight">You May Also Like</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((item) => (
              <ScholarshipCard key={item.id} scholarship={item} />
            ))}
          </div>
        </section>
      )}

      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "EducationalOccupationalProgram",
            name: s.title,
            description: s.description,
            url: `https://scholaratlas.dev/scholarships/${s.slug}`,
            provider: {
              "@type": "EducationalOrganization",
              name: s.provider,
            },
            offeredBy: s.university ? { "@type": "CollegeOrUniversity", name: s.university.name } : undefined,
            location: {
              "@type": "Place",
              name: countryName(s.countryCode),
            },
            educationalProgramMode: "fullTime",
          }),
        }}
      />
    </div>
  );
}

function OverviewRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function EligibilityCard({ icon, title, lines }: { icon: React.ReactNode; title: string; lines: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="text-primary">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not specified</p>
        ) : (
          <ul className="space-y-1.5">
            {lines.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
