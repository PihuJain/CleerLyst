import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const runtime = 'nodejs';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  // User provisioning happens in the NextAuth signIn callback (src/lib/auth.ts).
  // No separate DB write needed here.

  return <DashboardClient session={session}>{children}</DashboardClient>
}

