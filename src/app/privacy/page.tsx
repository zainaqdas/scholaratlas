import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How ScholarAtlas handles your personal information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="Demo environment — policy shown for illustration">
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
        choose. You can browse all public content without cookies.
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
