import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getNotificationsForUser } from "@/lib/database";
import { NotificationsClient } from "@/components/dashboard/notifications-client";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// /dashboard/notifications
// ---------------------------------------------------------------------------
//
// SECURITY INVARIANTS:
//   • Auth required — redirects to sign-in otherwise.
//   • Scoped to session user_id — no cross-user access.
//   • Only safe fields: id, dataset_id, dataset_title, type, read_at, created_at.
//   • No payload content. No student data. No record references.
//   • No bulk operations.
//
// ---------------------------------------------------------------------------

export default async function NotificationsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard/notifications");
  }

  const notifications = await getNotificationsForUser(session.user.id);

  const serialized = notifications.map((n) => ({
    id: n.id,
    dataset_id: n.dataset_id,
    dataset_title: n.dataset_title,
    type: n.type,
    read_at: n.read_at ? n.read_at.toISOString() : null,
    created_at: n.created_at.toISOString(),
  }));

  return <NotificationsClient notifications={serialized} />;
}
