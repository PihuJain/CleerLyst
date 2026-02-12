"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles, Zap, Code, Rocket, Github } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-muted/20 pt-20 sm:pt-16">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6 sm:space-y-8"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center space-x-2 bg-muted/50 backdrop-blur-sm border border-border rounded-full px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-muted-foreground"
          >
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="whitespace-nowrap">Ultimate AI SAAS Kit - Launch in Minutes</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-tight"
          >
            Build AI-Powered
            <br />
            <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              SAAS Applications
            </span>
            <br />
            in Minutes
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed px-4"
          >
            The complete toolkit for developers to create, customize, and launch
            AI-powered SAAS applications with authentication, payments, and modern UI components.
          </motion.p>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-wrap justify-center gap-4 text-sm"
          >
            <div className="flex items-center space-x-2 bg-muted/30 backdrop-blur-sm border border-border rounded-full px-4 py-2">
              <Zap className="w-4 h-4 text-primary" />
              <span>Next.js 15 + TypeScript</span>
            </div>
            <div className="flex items-center space-x-2 bg-muted/30 backdrop-blur-sm border border-border rounded-full px-4 py-2">
              <Code className="w-4 h-4 text-primary" />
              <span>ShadCN UI + Tailwind</span>
            </div>
            <div className="flex items-center space-x-2 bg-muted/30 backdrop-blur-sm border border-border rounded-full px-4 py-2">
              <Rocket className="w-4 h-4 text-primary" />
              <span>AI Integration Ready</span>
            </div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <Button
              size="lg"
              className="text-base font-medium px-6 py-3 h-12 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              asChild
            >
              <Link href="/get-started" className="flex items-center space-x-2">
                <span>Get Started Free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base font-medium px-6 py-3 h-12 rounded-lg border-2 hover:bg-muted/50 transition-all duration-300 hover:scale-105"
              asChild
            >
              <Link href="/demo">View Live Demo</Link>
            </Button>
          </motion.div>

          {/* GitHub Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="flex items-center justify-center pt-4"
          >
            <Button
              size="lg"
              variant="ghost"
              className="text-base font-medium px-6 py-3 h-12 rounded-lg hover:bg-muted/30 transition-all duration-300 hover:scale-105 border border-border/50"
              asChild
            >
              <Link
                href="https://github.com/zainulabedeen123/Best-Saas-Kit--V2"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2"
              >
                <Github className="w-5 h-5" />
                <span>View on GitHub</span>
              </Link>
            </Button>
          </motion.div>

          {/* Social Proof */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="pt-8 text-sm text-muted-foreground"
          >
            <p>Trusted by 1000+ developers worldwide</p>
            <div className="flex justify-center items-center space-x-8 mt-4 opacity-60">
              <div className="text-xs font-medium">⭐⭐⭐⭐⭐ 4.9/5</div>
              <div className="text-xs">•</div>
              <div className="text-xs font-medium">500+ GitHub Stars</div>
              <div className="text-xs">•</div>
              <div className="text-xs font-medium">Open Source</div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex justify-center"
        >
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1 h-3 bg-muted-foreground/50 rounded-full mt-2"
          />
        </motion.div>
      </motion.div>
    </section>
  )
}

export default Hero
