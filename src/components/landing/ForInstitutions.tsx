"use client";

import Link from "next/link";
import { SectionFade } from "./SectionFade";

const perks = [
  "Publish restricted results securely",
  "Share public announcements cleanly",
  "Enforce identifier-based access",
  "Maintain structured audit trails",
  "Reduce administrative overhead",
];

export default function ForInstitutions() {
  return (
    <section id="for-institutions" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionFade>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-center mb-4">
            For Institutions
          </h2>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-16 leading-relaxed">
            Cleerlyst gives academic departments and placement cells full control
            over how results are published.
          </p>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Left — Description + bullets */}
            <div>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Designed for academic offices, placement cells, and
                institutional committees. Cleerlyst replaces public spreadsheets
                with a controlled, private publishing workflow.
              </p>
              <ul className="space-y-3">
                {perks.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — Contact card */}
            <div className="rounded-xl border border-border bg-card p-8 transition-all duration-300 hover:border-emerald-500/20 hover:shadow-md">
              <h3 className="text-lg font-medium text-foreground mb-2">
                Interested in using Cleerlyst?
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                If you represent an academic department or placement office,
                contact us to enable access for your institute.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 transition-all duration-300"
              >
                Contact Institution Access
              </Link>
            </div>
          </div>
        </SectionFade>
      </div>
    </section>
  );
}
