"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { submitScholarshipAction } from "@/app/actions";
import { COUNTRIES, FIELDS, FUNDING_TYPES, PROVIDER_TYPES, STUDY_LEVELS, studyLevelSlug } from "@/lib/constants";

export function SubmitForm() {
  const [state, formAction, pending] = useActionState(submitScholarshipAction, { ok: false });
  const [agree, setAgree] = useState(false);
  const [levels, setLevels] = useState<string[]>([]);
  const [fields, setFields] = useState<string[]>([]);

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-10 text-center dark:border-emerald-900 dark:bg-emerald-950/50">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400" />
        <h2 className="mt-4 font-display text-2xl font-extrabold">Submission received</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-emerald-900 dark:text-emerald-200">
          Thank you! Your submission has entered our moderation queue. A member of our team will
          review it before it is published. You can keep browsing while we verify it.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link href="/scholarships">Browse Scholarships</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300" role="alert">
          {state.error}
        </p>
      )}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Scholarship details</legend>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="title">Scholarship name *</Label>
          <Input id="title" name="title" required placeholder="e.g. Global Excellence Scholarship" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="provider">Provider / organization *</Label>
          <Input id="provider" name="provider" required placeholder="e.g. University of Example" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="providerType">Provider type</Label>
          <Select name="providerType" defaultValue="UNIVERSITY">
            <SelectTrigger aria-label="Provider type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROVIDER_TYPES.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="countryCode">Destination country *</Label>
          <Select name="countryCode" required>
            <SelectTrigger aria-label="Destination country"><SelectValue placeholder="Select country" /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="officialUrl">Official website / application link *</Label>
          <Input id="officialUrl" name="officialUrl" required type="url" placeholder="https://example.com/scholarship" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" placeholder="What does this scholarship offer? Who is it for?" />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Academic profile</legend>
        <div className="space-y-1.5">
          <Label>Study levels (select one or more)</Label>
          <div className="flex flex-wrap gap-1.5">
            {STUDY_LEVELS.map((l) => {
              const slug = studyLevelSlug(l);
              const active = levels.includes(slug);
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() =>
                    setLevels(active ? levels.filter((x) => x !== slug) : [...levels, slug])
                  }
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-brand-blue/50 bg-brand-blue/10 text-brand-blue"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {l}
                </button>
              );
            })}
          </div>
          <input type="hidden" name="studyLevels" value={levels.join(",")} />
        </div>
        <div className="space-y-1.5">
          <Label>Fields of study (optional)</Label>
          <div className="max-h-40 overflow-y-auto rounded-xl border p-2">
            {FIELDS.map((f) => {
              const active = fields.includes(f.slug);
              return (
                <button
                  key={f.slug}
                  type="button"
                  onClick={() => setFields(active ? fields.filter((x) => x !== f.slug) : [...fields, f.slug])}
                  aria-pressed={active}
                  className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                    active ? "bg-brand-blue/10 text-brand-blue" : "text-foreground/80 hover:bg-muted"
                  }`}
                >
                  {f.icon} {f.name}
                </button>
              );
            })}
          </div>
          <input type="hidden" name="fields" value={fields.join(",")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fundingType">Funding type</Label>
          <Select name="fundingType" defaultValue="PARTIAL">
            <SelectTrigger aria-label="Funding type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FUNDING_TYPES.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deadline">Application deadline</Label>
          <Input id="deadline" name="deadline" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="applicationFee">Application fee</Label>
          <Input id="applicationFee" name="applicationFee" placeholder="e.g. Free or USD 50" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="academicRequirements">Academic requirements</Label>
          <Input id="academicRequirements" name="academicRequirements" placeholder="e.g. Bachelor's degree with 2:1 or above" />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Contact information</legend>
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Your name</Label>
          <Input id="contactName" name="contactName" placeholder="For internal contact" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactEmail">Contact email</Label>
          <Input id="contactEmail" name="contactEmail" type="email" placeholder="For internal contact" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Notes for the moderation team (optional)</Label>
          <Textarea id="notes" name="notes" placeholder="Anything our team should know?" />
        </div>
      </fieldset>

      <div className="flex items-start gap-2.5 rounded-xl border bg-muted/40 p-4">
        <Checkbox id="agree" checked={agree} onCheckedChange={(v) => setAgree(Boolean(v))} />
        <Label htmlFor="agree" className="text-sm leading-relaxed">
          I confirm that the information submitted is accurate, and I understand submissions are
          reviewed before publication. Never submit fabricated details.
        </Label>
      </div>

      <Button type="submit" disabled={pending || !agree} size="lg" className="gap-2">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Submit for Review
      </Button>
    </form>
  );
}
