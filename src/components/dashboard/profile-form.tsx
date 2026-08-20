"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateProfileAction } from "@/app/actions";
import { FieldIcon } from "@/components/category-icon";
import { COUNTRIES, FIELDS, STUDY_LEVELS, studyLevelSlug } from "@/lib/constants";
import type { User } from "@prisma/client";

export function ProfileForm({ user }: { user: User }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, { ok: false });

  return (
    <form action={formAction} className="space-y-5">
      {state.ok && (
        <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Profile saved. Recommendations will update.
        </p>
      )}
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input name="name" defaultValue={user.name ?? ""} placeholder="Your name" />
        </Field>
        <Field label="Graduation year">
          <Input name="graduationYear" defaultValue={user.graduationYear ?? ""} placeholder="e.g. 2027" />
        </Field>
        <Field label="Nationality">
          <Select name="nationality" defaultValue={user.nationality ?? ""}>
            <SelectTrigger aria-label="Nationality"><SelectValue placeholder="Select nationality" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Not specified</SelectItem>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Country of residence">
          <Select name="countryOfResidence" defaultValue={user.countryOfResidence ?? ""}>
            <SelectTrigger aria-label="Country of residence"><SelectValue placeholder="Select country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Not specified</SelectItem>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Degree level">
          <Select name="degreeLevel" defaultValue={user.degreeLevel ?? ""}>
            <SelectTrigger aria-label="Degree level"><SelectValue placeholder="Select level" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Not specified</SelectItem>
              {STUDY_LEVELS.map((l) => (
                <SelectItem key={l} value={studyLevelSlug(l)}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Field of study">
          <Select name="fieldOfStudy" defaultValue={user.fieldOfStudy ?? ""}>
            <SelectTrigger aria-label="Field of study"><SelectValue placeholder="Select field" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Not specified</SelectItem>
              {FIELDS.map((f) => (
                <SelectItem key={f.slug} value={f.slug}><FieldIcon slug={f.slug} className="mr-1.5 inline h-4 w-4" />{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Preferred destination">
          <Select name="preferredDestination" defaultValue={user.preferredDestination ?? ""}>
            <SelectTrigger aria-label="Preferred destination"><SelectValue placeholder="Where would you like to study?" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Not specified</SelectItem>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="IELTS / TOEFL status">
          <Input name="ieltsStatus" defaultValue={user.ieltsStatus ?? ""} placeholder="e.g. IELTS 6.5, none" />
        </Field>
        <Field label="GPA / academic performance">
          <Input name="gpa" defaultValue={user.gpa ?? ""} placeholder="e.g. 3.6/4.0" />
        </Field>
      </div>

      <Button type="submit" disabled={pending} className="gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Profile
      </Button>
      <p className="text-xs text-muted-foreground">
        Your profile is used only to personalize scholarship recommendations. It never affects
        your eligibility — always verify with the official provider.
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
