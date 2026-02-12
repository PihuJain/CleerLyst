// ============================================================================
// Admin configuration — Cleerlyst
// ============================================================================
// Admin status is determined by the `role` column in the users table,
// NOT by matching plaintext email against a hardcoded list.
//
// The old SaaS Kit checked ADMIN_EMAILS — that pattern is removed because
// Cleerlyst never exposes plaintext email in the session.
// ============================================================================

import type { Session } from "next-auth";

/** Admin permissions — extensible as needed. */
export const ADMIN_PERMISSIONS = {
  MANAGE_DATASETS: "manage_datasets",
  MANAGE_INSTITUTE: "manage_institute",
} as const;

export type AdminPermission =
  (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

/** Check whether a session user has the admin role. */
export function isAdmin(
  user: Session["user"] | null | undefined,
): boolean {
  return user?.role === "admin";
}

/**
 * All admins currently have all permissions.
 * Extend this if granular permission checks are needed later.
 */
export function getAdminPermissions(
  user: Session["user"] | null | undefined,
): AdminPermission[] {
  if (!isAdmin(user)) return [];
  return Object.values(ADMIN_PERMISSIONS);
}

/** Check whether an admin user has a specific permission. */
export function hasAdminPermission(
  user: Session["user"] | null | undefined,
  permission: AdminPermission,
): boolean {
  return getAdminPermissions(user).includes(permission);
}
