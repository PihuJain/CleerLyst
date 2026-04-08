"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function AdminDatasetsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="border-red-200 dark:border-red-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div className="space-y-3">
              <p className="font-medium text-red-800 dark:text-red-400">
                Something went wrong
              </p>
              <p className="text-sm text-muted-foreground">
                {error.message || "An unexpected error occurred while loading this page."}
              </p>
              <Button variant="outline" size="sm" onClick={reset}>
                Try again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
