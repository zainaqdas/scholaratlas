"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  COUNTRIES,
  DEADLINE_OPTIONS,
  FIELDS,
  FIELD_GROUPS,
  FIELD_OPTIONS,
  FUNDING_TYPES,
  LANGUAGE_OPTIONS,
  PROVIDER_TYPES,
  STUDY_LEVELS,
  fieldName,
  studyLevelSlug,
} from "./filter-options";

const DEADLINE_OPTIONS_LOCAL = DEADLINE_OPTIONS;
const FIELD_OPTIONS_LOCAL = FIELD_OPTIONS;
const LANGUAGE_OPTIONS_LOCAL = LANGUAGE_OPTIONS;

interface FilterSidebarProps {
  searchParams: URLSearchParams;
  onClose?: () => void;
  showNationality?: boolean;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand-blue/50 bg-brand-blue/10 text-brand-blue dark:border-blue-400/50 dark:bg-blue-400/15 dark:text-blue-300"
          : "border-border bg-card text-muted-foreground hover:border-brand-blue/30 hover:text-foreground dark:hover:border-blue-400/40"
      )}
    >
      {children}
      {active && <X className="h-3 w-3" />}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b py-5 first:pt-0 last:border-0">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

export function FilterSidebar({ searchParams, onClose, showNationality = true }: FilterSidebarProps) {
  const router = useRouter();
  const params = useMemo(() => new URLSearchParams(searchParams), [searchParams]);

  const [fieldQuery, setFieldQuery] = useState("");
  const [countryQuery, setCountryQuery] = useState("");

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "" ) {
        p.delete(key);
      } else {
        p.set(key, value);
      }
    }
    // reset to page 1 on filter change
    p.delete("page");
    onClose?.();
    router.push(`/scholarships${p.size ? `?${p.toString()}` : ""}`, { scroll: false });
  }

  function toggleList(key: string, value: string) {
    const current = (params.get(key) ?? "").split(",").filter(Boolean);
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update({ [key]: next.length ? next.join(",") : null });
  }

  function clearAll() {
    onClose?.();
    router.push("/scholarships", { scroll: false });
  }

  const activeCount =
    ["level", "funding", "country", "nationality", "field", "deadline", "provider", "language", "fee"].filter(
      (k) => params.get(k)
    ).length;

  const fieldQ = fieldQuery.toLowerCase();
  const visibleGroups = FIELD_GROUPS.map((g) => {
    const groupMatch = g.name.toLowerCase().includes(fieldQ);
    const children = groupMatch
      ? g.children
      : g.children.filter((slug) => fieldName(slug).toLowerCase().includes(fieldQ));
    return { ...g, children };
  }).filter((g) => g.name.toLowerCase().includes(fieldQ) || g.children.length > 0);
  const ungroupedFields = FIELDS.filter(
    (f) =>
      !FIELD_GROUPS.some((g) => g.children.includes(f.slug)) &&
      f.name.toLowerCase().includes(fieldQ)
  );
  const visibleCountries = COUNTRIES.filter((c) =>
    `${c.name} ${c.flag}`.toLowerCase().includes(countryQuery.toLowerCase())
  );

  const selectedLevels = (params.get("level") ?? "").split(",").filter(Boolean);
  const selectedFunding = (params.get("funding") ?? "").split(",").filter(Boolean);
  const selectedCountries = (params.get("country") ?? "").split(",").filter(Boolean);
  const selectedProviders = (params.get("provider") ?? "").split(",").filter(Boolean);
  const selectedLanguages = (params.get("language") ?? "").split(",").filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Filters</h2>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1 text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            Clear all ({activeCount})
          </Button>
        )}
      </div>

      <Section title="Study Level">
        <div className="flex flex-wrap gap-1.5">
          {STUDY_LEVELS.map((level) => {
            const slug = studyLevelSlug(level);
            return (
              <Chip key={slug} active={selectedLevels.includes(slug)} onClick={() => toggleList("level", slug)}>
                {level}
              </Chip>
            );
          })}
        </div>
      </Section>

      <Section title="Funding">
        <div className="flex flex-wrap gap-1.5">
          {FUNDING_TYPES.map((f) => (
            <Chip key={f.value} active={selectedFunding.includes(f.value)} onClick={() => toggleList("funding", f.value)}>
              {f.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Destination Country">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={countryQuery}
            onChange={(e) => setCountryQuery(e.target.value)}
            placeholder="Search countries..."
            className="h-8 pl-8 text-xs"
            aria-label="Search destination countries"
          />
        </div>
        <div className="grid max-h-44 grid-cols-1 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
          {visibleCountries.map((c) => (
            <Chip
              key={c.code}
              active={selectedCountries.includes(c.code)}
              onClick={() => toggleList("country", c.code)}
            >
              {c.flag} {c.name}
            </Chip>
          ))}
          {visibleCountries.length === 0 && (
            <p className="col-span-full text-xs text-muted-foreground">No countries match.</p>
          )}
        </div>
      </Section>

      {showNationality && (
        <Section title="Applicant Nationality">
          <Select
            value={params.get("nationality") ?? ""}
            onValueChange={(v) => update({ nationality: v || null })}
          >
            <SelectTrigger className="w-full" aria-label="Applicant nationality">
              <SelectValue placeholder="Any nationality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any nationality</SelectItem>
              <SelectItem value="international">International students</SelectItem>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Shows scholarships that list your nationality as eligible.
          </p>
        </Section>
      )}

      <Section title="Field of Study">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={fieldQuery}
            onChange={(e) => setFieldQuery(e.target.value)}
            placeholder="Search fields..."
            className="h-8 pl-8 text-xs"
            aria-label="Search fields of study"
          />
        </div>
        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {visibleGroups.map((g) => (
            <div key={g.slug} className="space-y-1.5">
              <Chip
                active={params.get("field") === g.slug}
                onClick={() => update({ field: params.get("field") === g.slug ? null : g.slug })}
              >
                {g.icon} {g.name}
              </Chip>
              <div className="flex flex-wrap gap-1.5 pl-1">
                {g.children.map((slug) => {
                  const f = FIELDS.find((x) => x.slug === slug);
                  if (!f) return null;
                  return (
                    <Chip
                      key={slug}
                      active={params.get("field") === slug}
                      onClick={() => update({ field: params.get("field") === slug ? null : slug })}
                    >
                      {f.name}
                    </Chip>
                  );
                })}
              </div>
            </div>
          ))}
          {ungroupedFields.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Other fields</p>
              <div className="flex flex-wrap gap-1.5 pl-1">
                {ungroupedFields.map((f) => (
                  <Chip
                    key={f.slug}
                    active={params.get("field") === f.slug}
                    onClick={() => update({ field: params.get("field") === f.slug ? null : f.slug })}
                  >
                    {f.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {visibleGroups.length === 0 && ungroupedFields.length === 0 && (
            <p className="text-xs text-muted-foreground">No fields match.</p>
          )}
        </div>
      </Section>

      <Section title="Deadline">
        <div className="flex flex-wrap gap-1.5">
          {DEADLINE_OPTIONS_LOCAL.map((d) => (
            <Chip key={d.value} active={params.get("deadline") === d.value} onClick={() => update({ deadline: params.get("deadline") === d.value ? null : d.value })}>
              {d.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Scholarship Provider">
        <div className="flex flex-wrap gap-1.5">
          {PROVIDER_TYPES.map((p) => (
            <Chip key={p.value} active={selectedProviders.includes(p.value)} onClick={() => toggleList("provider", p.value)}>
              {p.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Language Requirements">
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGE_OPTIONS_LOCAL.map((l) => (
            <Chip key={l.value} active={selectedLanguages.includes(l.value)} onClick={() => toggleList("language", l.value)}>
              {l.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Application Fee">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={params.get("fee") === "free"} onClick={() => update({ fee: params.get("fee") === "free" ? null : "free" })}>
            Free to apply
          </Chip>
          <Chip active={params.get("fee") === "required"} onClick={() => update({ fee: params.get("fee") === "required" ? null : "required" })}>
            Application fee required
          </Chip>
        </div>
      </Section>
    </div>
  );
}
