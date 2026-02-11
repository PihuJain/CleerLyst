import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/auth/signout-button";

export default async function ProfilePage() {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Info Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Account Overview</CardTitle>
            <CardDescription>
              Your account information and status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground font-semibold">
                  {user?.name?.charAt(0) || "U"}
                </span>
              </div>
              <div>
                <p className="font-medium">
                  {user?.name || "User"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Provider</span>
                <span className="text-sm font-medium">Google</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Status</span>
                <Badge variant="secondary">Active</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Plan</span>
                <Badge>Pro</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Actions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile Management</CardTitle>
              <CardDescription>
                Manage your account settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Account Information</h3>
                  <p className="text-sm text-muted-foreground">
                    Your account is managed through Google OAuth. To update your profile information,
                    please visit your Google account settings.
                  </p>
                </div>

                <div className="space-y-2">
                  <Button variant="outline" className="w-full" asChild>
                    <a href="https://myaccount.google.com" target="_blank" rel="noopener noreferrer">
                      Manage Google Account
                    </a>
                  </Button>

                  <SignOutButton className="w-full">
                    Sign Out
                  </SignOutButton>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
