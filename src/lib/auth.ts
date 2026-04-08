import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import {
  findInstituteByDomain,
  findUserByEmailHash,
  createUser,
  updateLastLogin,
} from "./database";
import { hashIdentifier } from "./identifier";

// ---------------------------------------------------------------------------
// Helper — extract domain from an email address
// ---------------------------------------------------------------------------

function domainOf(email: string): string | null {
  const parts = email.split("@");
  return parts.length === 2 ? parts[1].toLowerCase() : null;
}

// ---------------------------------------------------------------------------
// NextAuth configuration — Cleerlyst security model
//
//  1. signIn  → gate on institute domain, create user with email_hash only
//  2. jwt     → populate token with userId / role / instituteId (no email)
//  3. session → expose only safe fields to the client
// ---------------------------------------------------------------------------

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    // ------------------------------------------------------------------
    // signIn — domain gate + user provisioning
    // ------------------------------------------------------------------
    async signIn({ profile }) {
      const email = profile?.email;
      if (!email) return false;

      const domain = domainOf(email);
      if (!domain) return false;

      // Reject if domain is not in any institute's allowed_domains
      const institute = await findInstituteByDomain(domain);
      if (!institute) return false;

      // Hash email — plaintext is never persisted
      const emailHash = hashIdentifier(email, institute.id);

      // Find existing user or create a new one
      let user = await findUserByEmailHash(emailHash);
      if (!user) {
        user = await createUser(institute.id, emailHash);
      } else {
        await updateLastLogin(user.id);
      }

      return true;
    },

    // ------------------------------------------------------------------
    // jwt — attach Cleerlyst identity to the token
    // ------------------------------------------------------------------
    async jwt({ token, profile, trigger }) {
      if (trigger === "signIn" && profile?.email) {
        const domain = domainOf(profile.email);
        if (domain) {
          const institute = await findInstituteByDomain(domain);
          if (institute) {
            const emailHash = hashIdentifier(profile.email, institute.id);
            const user = await findUserByEmailHash(emailHash);
            if (user) {
              token.userId = user.id;
              token.role = user.role;
              token.instituteId = user.institute_id;
              token.emailHash = user.email_hash;
            }
          }
        }
      }

      // NEVER persist plaintext email in the JWT
      delete token.email;
      return token;
    },

    // ------------------------------------------------------------------
    // session — expose only non-sensitive fields to the client
    // ------------------------------------------------------------------
    async session({ session, token }) {
      session.user.id = (token.userId as string) ?? "";
      session.user.role = (token.role as "student" | "admin") ?? "student";
      session.user.instituteId = (token.instituteId as string) ?? "";

      // Strip plaintext email — it must never reach the client
      delete (session.user as unknown as Record<string, unknown>).email;

      return session;
    },
  },

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
});
