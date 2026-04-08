import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/auth/signin-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SignInPage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard/feed");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Welcome to Cleerlyst
          </CardTitle>
          <CardDescription>
            Sign in with your institute email to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInButton className="w-full rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 hover:shadow-md transition-all duration-300" />
        </CardContent>
      </Card>
    </div>
  );
}
