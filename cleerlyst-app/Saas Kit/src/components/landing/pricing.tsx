"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Star, Zap } from "lucide-react"
import { motion } from "framer-motion"
import { PricingClient } from "./pricing-client"

interface PricingProps {
  isAuthenticated?: boolean;
}

const Pricing = ({ isAuthenticated = false }: PricingProps) => {
  const plans = [
    {
      name: "Starter",
      price: "Free",
      description: "Perfect for getting started and small projects",
      features: [
        "Complete source code access",
        "Basic authentication setup",
        "Database schema & migrations",
        "Core UI components",
        "Documentation & guides",
        "Community support"
      ],
      cta: "Get Started Free",
      popular: false,
      variant: "outline" as const
    },
    {
      name: "Pro",
      price: "$99",
      period: "one-time",
      description: "Everything you need for production applications",
      features: [
        "Everything in Starter",
        "Advanced AI integrations",
        "Payment processing setup",
        "Admin dashboard",
        "Email templates",
        "Advanced analytics",
        "Priority support",
        "Lifetime updates"
      ],
      cta: "Get Pro Access",
      popular: true,
      variant: "default" as const
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For teams and large-scale applications",
      features: [
        "Everything in Pro",
        "Custom integrations",
        "White-label solution",
        "Dedicated support",
        "Custom training",
        "SLA guarantee",
        "Multi-tenant architecture",
        "Custom deployment"
      ],
      cta: "Contact Sales",
      popular: false,
      variant: "outline" as const
    }
  ]

  return (
    <section id="pricing" className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Simple, Transparent
            <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              {" "}Pricing
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Choose the plan that fits your needs. Start free and upgrade as you grow.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="relative"
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                    <Star className="w-4 h-4" />
                    <span>Most Popular</span>
                  </div>
                </div>
              )}
              
              <Card className={`h-full ${plan.popular ? 'border-primary shadow-lg scale-105' : 'border-border'} hover:shadow-lg transition-all duration-300`}>
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && (
                      <span className="text-muted-foreground ml-2">/{plan.period}</span>
                    )}
                  </div>
                  <CardDescription className="text-base mt-2">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start space-x-3">
                        <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <PricingClient
                    plan={plan}
                    isAuthenticated={isAuthenticated}
                  />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-24"
        >
          <h3 className="text-2xl font-bold text-center mb-12">Frequently Asked Questions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="space-y-4">
              <h4 className="font-semibold">What's included in the source code?</h4>
              <p className="text-muted-foreground text-sm">
                Complete Next.js application with authentication, database setup, AI integrations, 
                payment processing, and all UI components. Everything you need to launch.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">Do I get lifetime updates?</h4>
              <p className="text-muted-foreground text-sm">
                Yes! Pro and Enterprise plans include lifetime updates with new features, 
                security patches, and compatibility updates.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">Can I use this for client projects?</h4>
              <p className="text-muted-foreground text-sm">
                Absolutely! You can use the kit for unlimited personal and client projects. 
                Perfect for agencies and freelancers.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">What kind of support do you provide?</h4>
              <p className="text-muted-foreground text-sm">
                Community support for Starter, priority email support for Pro, 
                and dedicated support with SLA for Enterprise.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Money Back Guarantee */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className="bg-muted/30 rounded-2xl p-8 border border-border">
            <h3 className="text-xl font-bold mb-2">30-Day Money Back Guarantee</h3>
            <p className="text-muted-foreground">
              Not satisfied? Get a full refund within 30 days, no questions asked.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default Pricing
