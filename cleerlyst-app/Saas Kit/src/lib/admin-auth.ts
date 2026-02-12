import { auth } from "./auth";
import { isAdmin, hasAdminPermission, type AdminPermission } from "./admin-config";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

/** The user shape exposed by the Session type. */
type SessionUser = Session["user"];

/**
 * Check whether the current session user is an admin.
 * Uses `users.role` — no plaintext email involved.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const session = await auth();
  return isAdmin(session?.user);
}

/**
 * Return the current user if they are an admin, otherwise null.
 */
export async function getCurrentAdminUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user)) {
    return null;
  }
  return session.user;
}

/**
 * Require admin role — redirect to sign-in or dashboard on failure.
 */
export async function requireAdminAccess(): Promise<SessionUser> {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin");
  }

  if (!isAdmin(session.user)) {
    redirect("/dashboard?error=unauthorized");
  }

  return session.user;
}

/**
 * Require a specific admin permission.
 */
export async function requireAdminPermission(permission: AdminPermission): Promise<SessionUser> {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin");
  }

  if (!hasAdminPermission(session.user, permission)) {
    redirect("/dashboard?error=insufficient_permissions");
  }

  return session.user;
}

/**
 * Non-redirecting admin check for API routes.
 */
export async function checkAdminAccess(): Promise<{
  isAdmin: boolean;
  user: SessionUser | null;
}> {
  const session = await auth();

  if (!session?.user) {
    return { isAdmin: false, user: null };
  }

  return { isAdmin: isAdmin(session.user), user: session.user };
}
