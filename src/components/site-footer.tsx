import Link from "next/link";
import { Logo } from "@/components/logo";
import { CONTACT_EMAIL } from "@/lib/constants";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Discover",
    links: [
      { href: "/scholarships", label: "Scholarships" },
      { href: "/scholarships/fully-funded", label: "Fully Funded" },
      { href: "/scholarships/undergraduate", label: "Undergraduate" },
      { href: "/scholarships/masters", label: "Master's" },
      { href: "/scholarships/phd", label: "PhD" },
      { href: "/deadlines", label: "Deadlines" },
    ],
  },
  {
    title: "Explore",
    links: [
      { href: "/countries", label: "Countries" },
      { href: "/universities", label: "Universities" },
      { href: "/fields", label: "Fields of Study" },
      { href: "/scholarships/no-ielts", label: "No IELTS" },
      { href: "/scholarships/international-students", label: "International Students" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/resources", label: "Blog" },
      { href: "/resources", label: "Application Guides" },
      { href: "/resources", label: "Scholarship Tips" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Platform",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/submit-scholarship", label: "Submit Scholarship" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms" },
      { href: "/disclaimer", label: "Disclaimer" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Helping students discover opportunities without borders.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Questions?{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold tracking-wide text-foreground">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ScholarAtlas. Helping students discover opportunities without borders.
          </p>
          <p className="text-xs text-muted-foreground">
            ScholarAtlas is an information &amp; discovery service. It does not process scholarship applications.
          </p>
        </div>
      </div>
    </footer>
  );
}
