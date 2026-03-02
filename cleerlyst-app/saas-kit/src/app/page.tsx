import NavbarServer from "@/components/landing/NavbarServer";
import Hero from "@/components/landing/Hero";
import Problem from "@/components/landing/Problem";
import HowItWorks from "@/components/landing/HowItWorks";
import Institution from "@/components/landing/Institution";
import ForInstitutions from "@/components/landing/ForInstitutions";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-xl focus:bg-emerald-600 focus:px-4 focus:py-2 focus:text-white focus:text-sm"
      >
        Skip to content
      </a>
      <NavbarServer />
      <main id="main-content">
        <Hero />
        <Problem />
        <HowItWorks />
        <Institution />
        <ForInstitutions />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
