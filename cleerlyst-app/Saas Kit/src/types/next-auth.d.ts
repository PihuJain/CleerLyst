import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      /** Cleerlyst user UUID (from the users table) */
      id: string;
      /** 'student' | 'admin' */
      role: "student" | "admin";
      /** Institute UUID the user belongs to */
      instituteId: string;
      /** Display name from Google profile (not stored in DB) */
      name?: string | null;
      /** Google avatar URL (not stored in DB) */
      image?: string | null;
      // NOTE: email is intentionally omitted — never exposed to client
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: "student" | "admin";
    instituteId?: string;
    emailHash?: string;
    // email is deleted in the jwt callback — must not persist
  }
}
