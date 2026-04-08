import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SignInButton } from "@/components/auth/signin-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function SignInPage() {
  const session = await auth()

  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to Best SAAS Kit</CardTitle>
          <CardDescription>
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInButton className="w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
