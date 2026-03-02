"use client";

import { SectionFade } from "./SectionFade";

const steps = [
  {
    num: "01",
    title: "Institution uploads encrypted dataset",
    desc: "Academic departments upload results or announcements. Data is encrypted before storage.",
  },
  {
    num: "02",
    title: "Students verify identity securely",
    desc: "Students authenticate with their institute email. Identifiers are hashed \u2014 never stored in plain text.",
  },
  {
    num: "03",
    title: "Each student sees only their own result",
    desc: "Results are matched privately. No one else can see your data.",
  },
] as const;

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionFade>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-center mb-16">
            Private by design.
          </h2>

          <div className="max-w-2xl mx-auto space-y-0">
            {steps.map((s, i) => (
              <div key={s.num} className="relative pl-16 pb-12 last:pb-0 group">
                {/* Vertical connector */}
                {i < steps.length - 1 && (
                  <div className="absolute left-[1.375rem] top-10 bottom-0 w-px bg-border" />
                )}

                {/* Step number */}
                <div className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-muted-foreground group-hover:border-emerald-500/40 transition-colors duration-300">
                  {s.num}
                </div>

                <h3 className="text-base font-medium text-foreground mb-1">
                  {s.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </SectionFade>
      </div>
    </section>
  );
}
