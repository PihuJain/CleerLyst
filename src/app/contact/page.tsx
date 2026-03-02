import { ContactForm } from "@/components/contact/contact-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Clock } from "lucide-react";
import Link from "next/link";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-12">
      <div className="max-w-4xl mx-auto px-6">
        <div className="mb-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Back to home
          </Link>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold tracking-tight mb-4">
            Get in Touch
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            If you represent an academic institution and want to enable
            Cleerlyst for your department, reach out to us.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-emerald-500 mt-1" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-xs text-muted-foreground">
                      contact@cleerlyst.com
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-emerald-500 mt-1" />
                  <div>
                    <p className="text-sm font-medium">Response Time</p>
                    <p className="text-xs text-muted-foreground">
                      Within 24 hours
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
