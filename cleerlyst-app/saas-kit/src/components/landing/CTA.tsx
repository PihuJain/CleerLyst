"use client";

import { SignInButton } from "@/components/auth/signin-button";
import { SectionFade } from "./SectionFade";

export default function CTA() {
  return (
    <section className="py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <SectionFade>
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
              A private way to publish academic results.
            </h2>
            <p className="text-sm text-muted-foreground mb-8">
              Access is restricted to verified institute accounts.
            </p>
            <SignInButton className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 transition-all duration-300">
              Sign In
            </SignInButton>
          </div>
        </SectionFade>
      </div>
    </section>
  );
}
