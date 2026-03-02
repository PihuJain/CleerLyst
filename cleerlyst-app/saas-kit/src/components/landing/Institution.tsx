"use client";

import { SectionFade } from "./SectionFade";

const bullets = [
  "Encrypted at rest",
  "Identifier-based access",
  "Public & restricted publishing",
  "Structured audit logging",
  "Institute-level isolation",
  "Hash-verified identity matching",
];

export default function Institution() {
  return (
    <section className="py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <SectionFade>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-center mb-12">
            Built for institutional control.
          </h2>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Left — Narrative */}
            <div>
              <p className="text-muted-foreground leading-relaxed">
                Cleerlyst is designed for academic departments, placement cells,
                and institutional committees that need to publish sensitive
                information without compromising student privacy. Every record
                is encrypted, every identifier is hashed, and every access is
                scoped to the publishing institute.
              </p>
            </div>

            {/* Right — Feature bullets */}
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
              {bullets.map((b) => (
                <div key={b} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span className="text-sm text-muted-foreground">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionFade>
      </div>
    </section>
  );
}
