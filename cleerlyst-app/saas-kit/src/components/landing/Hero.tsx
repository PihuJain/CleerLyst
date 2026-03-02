"use client";

import { SignInButton } from "@/components/auth/signin-button";
import { SectionFade } from "./SectionFade";

function MockCard({
  title,
  badge,
  badgeColor,
  rows,
  accentLeft,
}: {
  title: string;
  badge: string;
  badgeColor: string;
  rows: { label: string; value: string }[];
  accentLeft?: string;
}) {
  return (
    <div
      className="rounded-xl border border-border bg-card/80 p-4 transition-colors duration-300"
      style={accentLeft ? { borderLeftWidth: 3, borderLeftColor: accentLeft } : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground truncate mr-2">{title}</span>
        <span
          className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${badgeColor}`}
        >
          {badge}
        </span>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="text-foreground">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative pt-32 pb-24 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <SectionFade>
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Left — Copy */}
            <div>
              <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-foreground leading-[1.08]">
                Secure Academic Results.{" "}
                <span className="text-emerald-500">Delivered Privately.</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
                Institutions publish verified datasets. Students see only what
                applies to them.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <SignInButton className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 transition-all duration-300">
                  Sign in with Institute Email
                </SignInButton>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center rounded-xl border border-border bg-muted px-6 py-3 text-sm font-medium text-foreground hover:bg-muted/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 transition-all duration-300"
                >
                  Learn how it works
                </a>
              </div>
            </div>

            {/* Right — Product mock */}
            <div className="relative" aria-hidden="true">
              <div className="rounded-2xl border border-border bg-card shadow-lg p-5 sm:p-6 space-y-4">
                <MockCard
                  title="Dell \u2014 Shortlisted Students"
                  badge="Selected"
                  badgeColor="bg-emerald-500/15 text-emerald-400"
                  accentLeft="#10b981"
                  rows={[
                    { label: "Status", value: "Selected" },
                    { label: "Interview Date", value: "12 March 2026" },
                    { label: "Location", value: "Virtual" },
                  ]}
                />
                <MockCard
                  title="Mid-Semester Proctor Meeting"
                  badge="Institute Update"
                  badgeColor="bg-blue-500/15 text-blue-400"
                  rows={[
                    { label: "Date", value: "18 March 2026" },
                    { label: "Venue", value: "Room 204" },
                  ]}
                />
              </div>
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-emerald-500/5 blur-2xl" />
            </div>
          </div>
        </SectionFade>
      </div>
    </section>
  );
}
