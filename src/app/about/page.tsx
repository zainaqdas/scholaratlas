import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Globe2, ShieldCheck, Sparkles, Telescope } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About ScholarAtlas",
  description:
    "ScholarAtlas helps students anywhere in the world discover scholarships they're eligible for, understand the requirements, and navigate to the official application source.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="text-center">
        <LogoMark className="mx-auto h-16 w-16" />
        <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Education Shouldn&apos;t Be Limited by{" "}
          <span className="text-gradient">Borders</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Millions of students never apply for scholarships they&apos;re eligible for — because the
          information is scattered, outdated, or buried in hard-to-read pages. ScholarAtlas brings
          it together in one clear, searchable place.
        </p>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        {[
          { icon: <Telescope className="h-6 w-6" />, title: "Our Mission", text: "Make scholarship opportunities easy to discover, understand and act on — for every student, everywhere." },
          { icon: <Globe2 className="h-6 w-6" />, title: "Our Vision", text: "A world where a student's future is limited by ambition and effort — not by access to information." },
          { icon: <ShieldCheck className="h-6 w-6" />, title: "Our Promise", text: "Honest data. Every listing links to the official source, and nothing is invented." },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border bg-card p-6">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-brand-indigo text-white">
              {item.icon}
            </span>
            <h2 className="mt-4 font-display text-lg font-bold">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
          </div>
        ))}
      </div>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">How the platform works</h2>
        <ol className="mt-6 space-y-5">
          {[
            { n: "1", text: "Scholarships are collected from official sources — universities, governments, foundations and organizations — and structured into a consistent format." },
            { n: "2", text: "You search and filter by country, study level, field, funding and eligibility. Everything is stored as structured data, so filtering is precise." },
            { n: "3", text: "Each listing clearly separates catalogue information from the official application website, with a verification status and a last-verified date." },
            { n: "4", text: "You apply directly on the official provider website — ScholarAtlas never processes applications and never asks for application fees." },
          ].map((step) => (
            <li key={step.n} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-indigo text-sm font-bold text-white">
                {step.n}
              </span>
              <p className="pt-1.5 leading-relaxed text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14 rounded-2xl border bg-card p-6">
        <h2 className="font-display text-xl font-bold">Data verification philosophy</h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          We never invent deadlines, funding amounts, eligibility rules or statistics. When a detail
          is unknown, we say <em>not specified</em> rather than guessing. Community submissions enter
          a moderation queue and are published only after review. Scholarship data can change —
          which is why every page reminds you to verify on the official source, and why you can
          report incorrect information with one click.
        </p>
      </section>

      <div className="mt-12 text-center">
        <Button asChild size="lg" className="gap-2">
          <Link href="/scholarships">
            <Sparkles className="h-4 w-4" />
            Start Discovering
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
