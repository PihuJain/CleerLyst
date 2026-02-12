import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/auth/save-user
 *
 * DEPRECATED — User provisioning now happens inside the NextAuth signIn
 * callback (src/lib/auth.ts). This endpoint is retained only to avoid
 * breaking existing client calls; it returns a 410 Gone status.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. User provisioning is handled automatically during sign-in.",
    },
    { status: 410 },
  );
}
