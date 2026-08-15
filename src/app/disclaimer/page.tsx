import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "Important disclaimers about the information on ScholarAtlas and how to apply safely.",
  alternates: { canonical: "/disclaimer" },
};

export default function DisclaimerPage() {
  return (
    <LegalShell title="Disclaimer" updated="Read before applying">
      <h2>Information may change</h2>
      <p>
        Scholarship deadlines, requirements, funding details and eligibility can change — sometimes
        without notice. The information on ScholarAtlas is a catalogue summary, not the source of
        truth. Always verify details on the official provider website before preparing or
        submitting an application.
      </p>
      <h2>Verify with official providers</h2>
      <p>
        Every listing links to the official application source. Eligibility decisions are made by
        the provider, not by ScholarAtlas. AI-generated recommendations are for discovery only and
        never constitute a guarantee of eligibility.
      </p>
      <h2>No guarantee of outcomes</h2>
      <p>
        ScholarAtlas does not guarantee admission or scholarship awards. If anyone asks you to pay a
        fee in exchange for a guaranteed scholarship, it is a scam — report it.
      </p>
      <h2>External websites</h2>
      <p>
        External websites are operated independently of ScholarAtlas. We are not responsible for
        their content, privacy practices or policies. Apply only through the official source shown
        on each listing.
      </p>
      <h2>An information service</h2>
      <p>
        ScholarAtlas is an information and discovery service unless explicitly stated otherwise. It
        does not process applications, does not collect application fees, and is not an agent of any
        scholarship provider.
      </p>
      <h2>Apply safely</h2>
      <p>
        Be wary of requests for unusual payments, fake scholarship websites, requests for sensitive
        information, unofficial agents, and guaranteed-scholarship claims. When in doubt, contact
        the provider directly through the official website.
      </p>
    </LegalShell>
  );
}

import { LegalShell } from "@/components/legal-shell";
