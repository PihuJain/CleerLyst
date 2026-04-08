"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function UploadError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/datasets">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Datasets
        </Link>
      </Button>

      <Card className="border-red-200 dark:border-red-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div className="space-y-3">
              <p className="font-medium text-red-800 dark:text-red-400">
                Failed to load upload page
              </p>
              <p className="text-sm text-muted-foreground">
                {error.message || "The dataset could not be loaded. It may have been deleted or you may not have access."}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}>
                  Try again
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin/datasets">Go to Datasets</Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
