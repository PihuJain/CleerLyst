import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground tracking-wide uppercase">
          Cleerlyst
        </span>

        <nav aria-label="Footer" className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors duration-200">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors duration-200">
            Terms
          </Link>
          <Link href="/contact" className="hover:text-foreground transition-colors duration-200">
            Contact
          </Link>
        </nav>

        <span className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Cleerlyst
        </span>
      </div>
    </footer>
  );
}
