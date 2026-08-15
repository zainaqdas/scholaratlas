import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing your use of ScholarAtlas.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="Demo environment — terms shown for illustration">
      <h2>1. What ScholarAtlas is</h2>
      <p>
        ScholarAtlas is an information and discovery service that catalogues scholarships and links
        to official providers. It does not award scholarships, process applications, or collect
        application fees.
      </p>
      <h2>2. Information accuracy</h2>
      <p>
        Scholarship information may change without notice. While we work to keep listings accurate,
        we do not guarantee completeness, accuracy or currency. Always verify details with the
        official provider.
      </p>
      <h2>3. Your account</h2>
      <p>
        You are responsible for keeping your credentials secure. Accounts may be suspended for
        misuse, including submitting fraudulent scholarship listings or abusing the reporting
        system.
      </p>
      <h2>4. Submissions</h2>
      <p>
        Submissions are reviewed before publication. By submitting, you confirm the information is
        accurate to the best of your knowledge and that you have the right to share it.
      </p>
      <h2>5. External links</h2>
      <p>
        External websites are operated independently. ScholarAtlas is not responsible for their
        content, practices or policies.
      </p>
      <h2>6. No guarantee of outcomes</h2>
      <p>
        ScholarAtlas does not guarantee admission, scholarship awards or application success. Beware
        of anyone who promises guaranteed scholarships for a fee.
      </p>
      <h2>7. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, ScholarAtlas is not liable for losses arising from
        reliance on catalogue information or from the use of external links.
      </p>
    </LegalShell>
  );
}

import { LegalShell } from "@/components/legal-shell";
