"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Columns3, Loader2 } from "lucide-react";
import { getCompareIds } from "@/components/compare/compare-button";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { countryFlag, countryName, fundingLabel, studyLevelFromSlug } from "@/lib/constants";
import { studyLevelsOf, hasNoIelts, isOpenToAll, eligibleOf } from "@/lib/scholarship";
import { formatShortDate } from "@/lib/format";
import type { Scholarship } from "@prisma/client";

type Row = Scholarship & { university?: { name: string } | null; country?: { name: string } | null };

export default function ComparePage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = getCompareIds();
    if (ids.length === 0) {
      setLoading(false);
      return;
    }
    fetch(`/api/scholarships?ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then((data: Row[]) => setItems(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length < 2) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          title="Compare Scholarships"
          description="Select at least two scholarships using the compare button on any scholarship card, then come back here."
          action={{ label: "Explore Scholarships", href: "/scholarships" }}
        />
      </div>
    );
  }

  const rows: { label: string; value: (s: Row) => React.ReactNode }[] = [
    { label: "Country", value: (s) => `${countryFlag(s.countryCode)} ${countryName(s.countryCode)}` },
    { label: "University / Provider", value: (s) => s.university?.name ?? s.provider },
    { label: "Degree", value: (s) => studyLevelsOf(s).map((l) => studyLevelFromSlug(l)).filter(Boolean).join(", ") || "Not specified" },
    { label: "Funding", value: (s) => fundingLabel(s.fundingType) },
    { label: "Value", value: (s) => s.amount || "Not specified" },
    { label: "Tuition", value: (s) => (s.benefits.includes("tuition") ? "Covered" : "—") },
    { label: "Stipend", value: (s) => (s.benefits.includes("stipend") ? "Covered" : "—") },
    { label: "Accommodation", value: (s) => (s.benefits.includes("accommodation") ? "Covered" : "—") },
    { label: "Airfare", value: (s) => (s.benefits.includes("airfare") ? "Covered" : "—") },
    { label: "IELTS", value: (s) => (hasNoIelts(s) ? "Not required" : "May be required") },
    { label: "Deadline", value: (s) => (s.deadline ? formatShortDate(s.deadline) : "Open / rolling") },
    { label: "Eligibility", value: (s) => (isOpenToAll(s) ? "All nationalities" : `${eligibleOf(s).length} countries` ) },
    { label: "Application fee", value: (s) => s.applicationFee || "Free" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue to-brand-indigo text-white">
          <Columns3 className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Compare Scholarships</h1>
          <p className="mt-1 text-muted-foreground">
            Side-by-side comparison of {items.length} selected opportunities.
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-40 p-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Feature
              </th>
              {items.map((s) => (
                <th key={s.id} className="min-w-[220px] p-4 text-left align-top">
                  <Link href={`/scholarships/${s.slug}`} className="font-display font-bold leading-snug hover:text-primary">
                    {s.title}
                  </Link>
                  <p className="mt-1 text-xs font-normal text-muted-foreground">
                    {countryFlag(s.countryCode)} {countryName(s.countryCode)}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.label} className={i % 2 ? "bg-muted/30" : ""}>
                <td className="p-4 font-medium text-muted-foreground">{row.label}</td>
                {items.map((s) => (
                  <td key={s.id} className="p-4 align-top">
                    {row.value(s)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="p-4" />
              {items.map((s) => (
                <td key={s.id} className="p-4">
                  <Button asChild size="sm" variant="outline">
                    <a href={s.officialUrl} target="_blank" rel="noopener noreferrer">
                      Official website
                    </a>
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Comparison is based on catalogue data. Always verify funding details and eligibility on the
        official provider website.
      </p>
    </div>
  );
}
