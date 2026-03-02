import { requireAdminAccess } from "@/lib/admin-auth";
import { AdminClient } from "@/components/admin/admin-client";

export const runtime = 'nodejs';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This will redirect if user is not admin
  const adminUser = await requireAdminAccess();

  return <AdminClient adminUser={adminUser}>{children}</AdminClient>;
}
