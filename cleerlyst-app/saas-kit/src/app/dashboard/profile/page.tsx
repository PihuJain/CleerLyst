import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IdentifiersSection } from "@/components/profile/identifiers-section";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /dashboard/profile
// ---------------------------------------------------------------------------
//
// SECURITY INVARIANTS:
//   • Auth required — unauthenticated users are redirected.
//   • Identifier values are fetched client-side ONLY (after auth).
//   • No sensitive data is pre-rendered in server HTML.
//   • No identifier values are logged.
//
// ---------------------------------------------------------------------------

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const user = session.user;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Manage your account details and institutional identifiers.
        </p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            Your basic account details from your institution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium">
                {user.name || "Not set"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Role</span>
              <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                {user.role === "admin" ? "Admin" : "Student"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Institutional Identifiers — client-side only */}
      <IdentifiersSection />
    </div>
  );
}
