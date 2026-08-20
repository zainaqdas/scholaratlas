import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How ScholarAtlas handles your personal information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="Last updated: August 2026">
      <h2>What we collect</h2>
      <p>
        When you create an account we store your email address, a password hash, and any profile
        information you choose to provide (nationality, field of study, preferred destination, and
        similar). Profile data is used only to personalize scholarship recommendations.
      </p>
      <h2>What we do not collect</h2>
      <p>
        We do not collect payment information, and we never ask for documents or fees. We do not
        share your personal data with third parties for marketing.
      </p>
      <h2>Analytics</h2>
      <p>
        We track aggregate platform events — scholarship views, searches, saves and outbound clicks —
        to improve the product. This is aggregated and not tied to your identity where possible.
      </p>
      <h2>Cookies</h2>
      <p>
        We use a session cookie to keep you signed in and a local preference for the theme you
        choose. You can browse all public content without cookies. When you first visit, we ask for
        your consent before enabling optional cookies (analytics and, once enabled, advertising).
        You can change your choice anytime via the consent banner.
      </p>
      <h2>Analytics &amp; advertising</h2>
      <p>
        With your consent, we use privacy-friendly analytics to understand aggregate traffic — which
        pages are visited and how the site is used — so we can improve it. If we later display
        advertising, third-party ad networks (such as Google AdSense) may set their own cookies to
        serve and measure relevant ads, and to report aggregate impressions and clicks. You can opt
        out of these cookies at any time from the consent banner, or through your browser settings.
      </p>
      <h2>Third-party services</h2>
      <p>
        We use a few service providers to operate the site — hosting, email delivery (Resend) and
        database services (Turso). These providers process data only on our behalf, and each has
        its own privacy policy governing that processing. We never sell your personal data.
      </p>
      <h2>Your rights</h2>
      <p>
        You can view, correct or delete your profile at any time from your dashboard. To delete your
        account, contact us and we&apos;ll remove your data.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about this policy? Reach us via the{" "}
        <a href="/contact" className="text-primary hover:underline">contact page</a>.
      </p>
    </LegalShell>
  );
}

import { LegalShell } from "@/components/legal-shell";
