import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export const runtime = "nodejs";

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  AccessDenied: {
    title: "Access Denied",
    description:
      "Your email domain is not associated with a registered institute. Only institutional emails are allowed.",
  },
  Configuration: {
    title: "Configuration Error",
    description: "There is a problem with the server configuration. Please try again later.",
  },
  Verification: {
    title: "Verification Failed",
    description: "The sign-in link is no longer valid. It may have been used already or expired.",
  },
};

const DEFAULT_ERROR = {
  title: "Authentication Error",
  description: "Something went wrong during sign in. Please try again.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorCode } = await searchParams;
  const errorInfo = ERROR_MESSAGES[errorCode ?? ""] ?? DEFAULT_ERROR;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {errorInfo.title}
          </CardTitle>
          <CardDescription className="mt-1">
            {errorInfo.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/auth/signin">Try Again</Link>
          </Button>
          <Button variant="ghost" asChild className="w-full">
            <Link href="/">Back to Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
