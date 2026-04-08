import Navigation from "@/components/landing/navigation"
import Hero from "@/components/landing/hero"
import Features from "@/components/landing/features"
import Pricing from "@/components/landing/pricing"
import Testimonials from "@/components/landing/testimonials"
import Footer from "@/components/landing/footer"
import { SmoothScroll } from "@/components/ui/smooth-scroll"
import { ScrollToTop } from "@/components/ui/scroll-to-top"

export default function Home() {
  return (
    <div className="min-h-screen">
      <SmoothScroll />
      <Navigation />
      <Hero />
      <Features />
      <Pricing />
      <Testimonials />
      <Footer />
      <ScrollToTop />
    </div>
  )
}
