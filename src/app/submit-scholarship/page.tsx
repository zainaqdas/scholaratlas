import type { Metadata } from "next";
import { SubmitForm } from "@/components/submit/submit-form";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Submit a Scholarship",
  description:
    "Universities, organizations and students can submit scholarship information. All submissions are reviewed before publication.",
  alternates: { canonical: "/submit-scholarship" },
};

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue to-brand-indigo text-white">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Submit a Scholarship</h1>
          <p className="mt-1 text-muted-foreground">
            Share an opportunity with students around the world.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
        <strong>How moderation works:</strong> every submission enters a review queue. Our team checks
        it against the official source before publishing. Unverified submissions are never published
        automatically.
      </div>

      <div className="mt-8 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <SubmitForm />
      </div>
    </div>
  );
}
