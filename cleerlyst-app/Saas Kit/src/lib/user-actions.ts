"use server";

import { auth } from "./auth";

/**
 * Returns the current authenticated user's safe (non-sensitive) profile.
 *
 * User provisioning now happens inside the NextAuth signIn callback
 * (see src/lib/auth.ts). This action only reads the session — it never
 * touches plaintext email and never writes to the DB.
 */
export async function getAuthenticatedUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false as const, error: "Not authenticated" };
  }

  return {
    success: true as const,
    user: {
      id: session.user.id,
      role: session.user.role,
      instituteId: session.user.instituteId,
      name: session.user.name ?? null,
      image: session.user.image ?? null,
    },
  };
}
