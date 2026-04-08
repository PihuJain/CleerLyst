import Link from "next/link";

export const metadata = {
  title: "Terms of Use — Cleerlyst",
  description:
    "Terms governing use of Cleerlyst for institutions and students.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-12">
      <div className="max-w-3xl mx-auto px-6">
        <div className="mb-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Back to home
          </Link>
        </div>

        <h1 className="text-4xl font-semibold tracking-tight mb-2">
          Terms of Use
        </h1>
        <p className="text-sm text-muted-foreground mb-12">
          Last updated: March 2026
        </p>

        <div className="space-y-10 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-medium text-foreground mb-3">
              Acceptance
            </h2>
            <p>
              By using Cleerlyst, you agree to these Terms of Use. If you are
              using Cleerlyst on behalf of an institution, you represent that
              you have authority to bind that institution to these terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-3">
              Description of Service
            </h2>
            <p>
              Cleerlyst is a secure platform that enables academic institutions
              to publish verified datasets (e.g., results, announcements) and
              allows students to access only the information that applies to
              them. Access is controlled by institute-verified identity and
              identifier-based matching. Data is encrypted at rest and
              identifiers are hashed; we do not store plaintext identifiers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-3">
              Acceptable Use
            </h2>
            <p className="mb-3">You agree to use Cleerlyst only for lawful purposes.</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Do not upload data you do not have the right to publish.
              </li>
              <li>
                Do not attempt to bypass access controls, decrypt data without
                authorisation, or access another user&apos;s results.
              </li>
              <li>
                Do not use the service to distribute malware, spam, or
                fraudulent content.
              </li>
              <li>
                Do not abuse the API or infrastructure (e.g., excessive requests,
                automated scraping).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-3">
              Institution Responsibilities
            </h2>
            <p>
              Institutions that use Cleerlyst are responsible for the accuracy
              and legality of the data they upload. They must ensure that
              students have been informed about how their identifiers and data
              will be used. Institutions must comply with applicable data
              protection and privacy laws in their jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-3">
              Data Handling
            </h2>
            <p>
              Our data handling practices are described in our{" "}
              <Link
                href="/privacy"
                className="text-emerald-500 hover:text-emerald-400 underline"
              >
                Privacy Policy
              </Link>
              . By using Cleerlyst, you acknowledge that you have read and
              understood that policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-3">
              Service Availability
            </h2>
            <p>
              We strive to maintain high availability but do not guarantee
              uninterrupted service. We may perform maintenance, updates, or
              address security issues with or without advance notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-3">
              Limitation of Liability
            </h2>
            <p>
              Cleerlyst is provided &quot;as is&quot;. To the extent permitted by law,
              we are not liable for indirect, incidental, or consequential
              damages arising from your use of the service. Our liability is
              limited to the amount you have paid to use Cleerlyst in the
              twelve months preceding the claim, or the minimum amount permitted
              by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-3">
              Changes
            </h2>
            <p>
              We may update these terms from time to time. Material changes will
              be communicated via the service or by email where appropriate.
              Continued use after changes constitutes acceptance of the updated
              terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-3">
              Contact
            </h2>
            <p>
              For questions about these terms, contact us via our{" "}
              <Link
                href="/contact"
                className="text-emerald-500 hover:text-emerald-400 underline"
              >
                contact page
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
