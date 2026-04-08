import { auth } from "./auth";

/**
 * Returns the current session user or undefined if not logged in.
 */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user;
}

/**
 * Throws if no session exists. Returns the authenticated user.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Authentication required");
  }
  return session.user;
}

/**
 * Throws if the user is not an admin.
 */
export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "admin") {
    throw new Error("Admin access required");
  }
  return user;
}

/**
 * Throws if the user is not a student.
 */
export async function requireStudent() {
  const user = await requireAuth();
  if (user.role !== "student") {
    throw new Error("Student access required");
  }
  return user;
}
