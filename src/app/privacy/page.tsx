import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Cleerlyst",
  description:
    "How Cleerlyst handles your data: encryption, hashing, and access control.",
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mb-12">
          Last updated: March 2026
        </p>

        <div className="space-y-10 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-medium text-foreground mb-3">
              Overview
            </h2>
            <p>
              Cleerlyst is a secure platform for institutions to publish academic
              results and announcements. We are designed for privacy by default.
              This document explains what data we store, how it is protected, and
              who can access it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-3">
              Data We Store
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Account data:</strong> Your
                email address is never stored in plain text. We store a
                one-way hash of your email for authentication and institute
                association.
              </li>
              <li>
                <strong className="text-foreground">Identifiers:</strong> If you
                add a registration number or similar identifier, it is encrypted
                with AES-256-GCM before storage. We never store identifiers in
                plain text.
              </li>
              <li>
                <strong className="text-foreground">Dataset records:</strong>{" "}
                Academic data uploaded by institutions is encrypted at rest using
                AES-256-GCM. Each record is matched to students via a
                one-way hash of the identifier, not the identifier itself.
              </li>
              <li>
                <strong className="text-foreground">Audit metadata:</strong> We
                store timestamps and action logs (e.g., when a dataset was
                published) for institutional accountability. These logs do not
                contain sensitive personal data.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-3">
              How We Protect Data
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Encryption at rest:</strong>{" "}
                All sensitive payloads are encrypted with AES-256-GCM before
                being written to the database. Decryption occurs only when
                serving a matched result to the authorised user.
              </li>
              <li>
                <strong className="text-foreground">Hash-based matching:</strong>{" "}
                Identifiers (e.g., registration numbers) are hashed with
                SHA-256 and an institute-specific salt. We never compare
                plaintext identifiers. This prevents reverse lookup and
                cross-institute correlation.
              </li>
              <li>
                <strong className="text-foreground">Institute isolation:</strong>{" "}
                Each institution&apos;s data is strictly isolated. Users from one
                institute cannot access data from another.
              </li>
              <li>
                <strong className="text-foreground">No enumeration:</strong> We
                do not expose bulk lists of records. A student can only retrieve
                results that match their own verified identifiers.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-3">
              Who Can See What
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Students:</strong> You see
                only datasets published by your institute. For restricted
                datasets, you see only the record that matches your identifier.
                You cannot see other students&apos; results.
              </li>
              <li>
                <strong className="text-foreground">Institution admins:</strong>{" "}
                Admins can manage datasets they create (upload, publish, revoke,
                set visibility). They cannot decrypt or view individual student
                results. They see metadata (e.g., dataset titles, status) but not
                the underlying record contents.
              </li>
              <li>
                <strong className="text-foreground">Cleerlyst:</strong> We
                operate the infrastructure. We do not access decrypted data for
                analytics or marketing. Our access is limited to operational
                support and security incident response.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-3">
              What We Do Not Track
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>We do not sell or share your data with third parties.</li>
              <li>
                We do not use your data for advertising or profiling.
              </li>
              <li>
                We do not log which specific results you view beyond what is
                necessary for serving the request.
              </li>
              <li>
                We do not store plaintext identifiers anywhere in our system.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-3">
              Data Retention
            </h2>
            <p>
              Data is retained for as long as your institute uses Cleerlyst and
              your account remains active. If an institution discontinues use, we
              will work with them to handle data deletion or export in accordance
              with their policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-foreground mb-3">
              Contact
            </h2>
            <p>
              For questions about this policy or to exercise your rights, contact
              us at{" "}
              <Link
                href="/contact"
                className="text-emerald-500 hover:text-emerald-400 underline"
              >
                our contact page
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
