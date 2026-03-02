"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignInButton } from "@/components/auth/signin-button";

interface NavbarProps {
  session: unknown;
}

export function Navbar({ session }: NavbarProps) {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "How It Works", href: "#how-it-works" },
    { label: "For Institutions", href: "#for-institutions" },
  ];

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-background/90 backdrop-blur-md border-b border-border"
          : "bg-transparent",
      )}
    >
      <div className="max-w-6xl mx-auto px-6 flex h-16 items-center justify-between">
        <Link
          href="/"
          className="text-lg font-semibold tracking-widest uppercase text-foreground"
        >
          Cleerlyst
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 rounded-md px-1 py-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            >
              {l.label}
            </a>
          ))}

          {session ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 hover:shadow-md transition-all duration-300"
            >
              Dashboard
            </Link>
          ) : (
            <SignInButton className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 hover:shadow-md transition-all duration-300">
              Sign In
            </SignInButton>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="md:hidden p-2 text-muted-foreground hover:text-foreground"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-300 ease-in-out px-6",
          mobileOpen ? "max-h-64 opacity-100 pb-4" : "max-h-0 opacity-0",
        )}
      >
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="block py-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(false)}
          >
            {l.label}
          </a>
        ))}
        <div className="pt-3 border-t border-border mt-2">
          {session ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center w-full rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white"
            >
              Dashboard
            </Link>
          ) : (
            <SignInButton className="w-full rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white">
              Sign In
            </SignInButton>
          )}
        </div>
      </div>
    </nav>
  );
}
