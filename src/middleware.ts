import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Middleware — Edge-compatible, zero Node.js dependencies
// ---------------------------------------------------------------------------
//
// This middleware runs in the Edge runtime. It MUST NOT import:
//   • @/lib/auth     (pulls pg, crypto, AsyncLocalStorage)
//   • @/lib/database  (Node-only pg driver)
//   • @/lib/hash      (Node crypto module)
//   • @/lib/request-context (AsyncLocalStorage)
//
// Auth protection for /dashboard and /admin is handled by their
// respective server-side layouts (which run in Node.js runtime).
//
// This middleware only:
//   1. Attaches a unique x-request-id header to every request
//   2. Checks for a session cookie on protected routes (lightweight)
// ---------------------------------------------------------------------------

export function middleware(request: NextRequest) {
  const requestId = globalThis.crypto.randomUUID();

  // Protected paths that require authentication
  const protectedPaths = ["/dashboard", "/admin"];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  // Lightweight session check: look for the NextAuth session cookie.
  // This does NOT validate the session — just checks if the cookie exists.
  // Full auth validation happens server-side in each layout/route handler.
  const hasSessionCookie =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token");

  if (isProtectedPath && !hasSessionCookie) {
    const signInUrl = new URL("/auth/signin", request.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Attach request ID and continue
  const response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });
  response.headers.set("x-request-id", requestId);

  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
