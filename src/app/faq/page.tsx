import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers to common questions about ScholarAtlas, scholarships, eligibility and applications.",
  alternates: { canonical: "/faq" },
};

const FAQS = [
  {
    q: "Are these scholarships free to apply for?",
    a: "Most are, but some providers charge an application fee. We display the application fee on every listing where it is known — if it isn't stated, check the official provider page.",
  },
  {
    q: "Are all scholarships fully funded?",
    a: "No. We list fully funded, tuition-waiver and partial funding options. Use the Funding filter to narrow down, and check the exact coverage on each listing.",
  },
  {
    q: "How do I know if I'm eligible?",
    a: "Each listing shows eligible nationalities, academic requirements, language requirements and other conditions. These are catalogue summaries — always confirm eligibility on the official provider website, because requirements change.",
  },
  {
    q: "Does ScholarAtlas provide scholarships directly?",
    a: "No. ScholarAtlas is an information and discovery service. We do not award scholarships, process applications or collect application fees.",
  },
  {
    q: "Can I apply through ScholarAtlas?",
    a: "No — applications are processed on the official provider website. Every listing includes a 'Visit Official Scholarship Website' button that takes you to the source.",
  },
  {
    q: "How frequently is scholarship information updated?",
    a: "Listings carry a 'Last Verified' date so you can judge freshness. Data is reviewed on an ongoing basis, and you can report incorrect information on any page.",
  },
  {
    q: "Can universities submit scholarships?",
    a: "Yes — universities, governments, foundations and organizations can submit listings through the submission form. Submissions enter a moderation queue and are verified before publication.",
  },
  {
    q: "How do I report incorrect information?",
    a: "Use the 'Report Incorrect Information' button on any scholarship page. Reports go straight to our moderation team.",
  },
  {
    q: "Are international students eligible?",
    a: "Many listings are open to international students — use the 'International Students' filter or the applicant-nationality filter to find opportunities that match your situation.",
  },
  {
    q: "Can I receive deadline alerts?",
    a: "Save scholarships to your account and check your dashboard and the Deadlines page for countdowns. Email alerts are planned — we never send notifications without your consent.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Frequently Asked Questions</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Everything you need to know about using ScholarAtlas. Can&apos;t find an answer?{" "}
          <Link href="/contact" className="font-medium text-primary hover:underline">Contact us</Link>.
        </p>
      </div>

      <div className="mt-10 space-y-3">
        {FAQS.map((faq) => (
          <details key={faq.q} className="group rounded-2xl border bg-card p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
              {faq.q}
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
