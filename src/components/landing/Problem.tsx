"use client";

import { FileText, Eye, MessageCircleWarning } from "lucide-react";
import { SectionFade } from "./SectionFade";

const cards = [
  {
    icon: FileText,
    title: "Mass PDF lists",
    desc: "Anyone can search your roll number.",
  },
  {
    icon: Eye,
    title: "Public roll-number sheets",
    desc: "No privacy. No control.",
  },
  {
    icon: MessageCircleWarning,
    title: "Manual verification chaos",
    desc: "Emails. WhatsApp. Confusion.",
  },
] as const;

export default function Problem() {
  return (
    <section className="py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <SectionFade>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-center mb-12">
            Results shouldn&apos;t be public spreadsheets.
          </h2>

          <div className="grid sm:grid-cols-3 gap-6 md:gap-8">
            {cards.map((c) => (
              <div
                key={c.title}
                className="rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-500/20"
              >
                <c.icon
                  className="h-6 w-6 text-muted-foreground mb-4"
                  strokeWidth={1.5}
                />
                <h3 className="text-base font-medium text-foreground mb-1">
                  {c.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {c.desc}
                </p>
              </div>
            ))}
          </div>
        </SectionFade>
      </div>
    </section>
  );
}
