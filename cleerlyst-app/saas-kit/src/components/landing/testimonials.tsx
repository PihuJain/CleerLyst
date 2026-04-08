"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Star } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"

const Testimonials = () => {
  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Founder, AI Startup",
      company: "TechFlow",
      content: "This kit saved me months of development time. I went from idea to MVP in just 2 weeks. The AI integrations are seamless and the code quality is exceptional.",
      rating: 5,
      avatar: "/api/placeholder/40/40"
    },
    {
      name: "Marcus Rodriguez",
      role: "Senior Developer",
      company: "InnovateLabs",
      content: "The best SAAS starter kit I've used. Clean architecture, modern stack, and excellent documentation. My team was productive from day one.",
      rating: 5,
      avatar: "/api/placeholder/40/40"
    },
    {
      name: "Emily Watson",
      role: "Product Manager",
      company: "DataCorp",
      content: "We launched our AI-powered analytics platform using this kit. The built-in authentication and payment processing saved us countless hours.",
      rating: 5,
      avatar: "/api/placeholder/40/40"
    },
    {
      name: "David Kim",
      role: "Indie Hacker",
      company: "Solo Founder",
      content: "As a solo founder, this kit was a game-changer. I could focus on my unique features instead of rebuilding the same boilerplate code.",
      rating: 5,
      avatar: "/api/placeholder/40/40"
    },
    {
      name: "Lisa Thompson",
      role: "CTO",
      company: "StartupXYZ",
      content: "The scalability and performance optimizations are impressive. We're handling thousands of users without any issues. Highly recommended!",
      rating: 5,
      avatar: "/api/placeholder/40/40"
    },
    {
      name: "Alex Johnson",
      role: "Full Stack Developer",
      company: "FreelanceForce",
      content: "I've built multiple client projects with this kit. The TypeScript setup and component library make development a breeze. Worth every penny.",
      rating: 5,
      avatar: "/api/placeholder/40/40"
    }
  ]

  return (
    <section id="testimonials" className="py-24 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Loved by
            <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              {" "}Developers
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Join thousands of developers who have successfully launched their AI SAAS applications 
            using our comprehensive toolkit.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16"
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">1000+</div>
            <div className="text-muted-foreground">Happy Developers</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">500+</div>
            <div className="text-muted-foreground">Apps Launched</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">4.9/5</div>
            <div className="text-muted-foreground">Average Rating</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">99%</div>
            <div className="text-muted-foreground">Satisfaction Rate</div>
          </div>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  {/* Rating */}
                  <div className="flex items-center space-x-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>

                  {/* Content */}
                  <blockquote className="text-muted-foreground mb-6 leading-relaxed">
                    "{testimonial.content}"
                  </blockquote>

                  {/* Author */}
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {testimonial.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-sm">{testimonial.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {testimonial.role} at {testimonial.company}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-2xl p-8 border border-primary/20">
            <h3 className="text-2xl font-bold mb-4">Join the Success Stories</h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Don't just take our word for it. Start building your AI SAAS today and 
              see why developers love our toolkit.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Start Your Success Story
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="border border-border px-8 py-3 rounded-lg font-medium hover:bg-muted/50 transition-colors"
              >
                Read More Reviews
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default Testimonials
