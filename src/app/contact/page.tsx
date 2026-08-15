import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageSquareText, Newspaper, ShieldCheck, Wrench } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { CONTACT_EMAIL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the ScholarAtlas team — general questions, corrections, partnerships and support.",
  alternates: { canonical: "/contact" },
};

const OPTIONS = [
  { icon: <MessageSquareText className="h-5 w-5" />, title: "General contact", text: `Questions about the platform or a listing — write to ${CONTACT_EMAIL}.` },
  { icon: <ShieldCheck className="h-5 w-5" />, title: "Scholarship corrections", text: "Found an error in a listing? Use the report button on the scholarship page, or email corrections@" + CONTACT_EMAIL.split("@")[1] + "." },
  { icon: <Newspaper className="h-5 w-5" />, title: "Partnership requests", text: "Universities and organizations — partner with us to list official scholarships." },
  { icon: <Wrench className="h-5 w-5" />, title: "Technical support", text: "Having trouble with your account, saved scholarships or alerts? Contact support." },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Contact Us</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          We read every message. Tell us what you need and we&apos;ll point you in the right
          direction.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <div key={o.title} className="rounded-2xl border bg-card p-6">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue/15 to-brand-indigo/15 text-primary">
              {o.icon}
            </span>
            <h2 className="mt-3 font-semibold">{o.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{o.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="font-display text-xl font-bold">Send us a message</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Prefer email? Reach us directly at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
          <div className="mt-5">
            <ContactForm />
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="font-display text-xl font-bold">Before you write…</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>
              • <strong className="text-foreground">Eligibility questions</strong> about a specific
              scholarship? Contact the provider — we don&apos;t process applications.{" "}
              <Link href="/disclaimer" className="text-primary hover:underline">Learn why</Link>.
            </li>
            <li>
              • <strong className="text-foreground">Incorrect listing?</strong> Use the{" "}
              <em>Report Incorrect Information</em> button on the scholarship page — it goes
              straight to moderation.
            </li>
            <li>
              • <strong className="text-foreground">Submit a scholarship?</strong> Use the{" "}
              <Link href="/submit-scholarship" className="text-primary hover:underline">submission form</Link>.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
