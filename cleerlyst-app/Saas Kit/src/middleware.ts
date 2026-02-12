import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const requestId = crypto.randomUUID()

  // Attach requestId to request headers
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-request-id", requestId)

  // Define protected routes
  const protectedPaths = ['/dashboard']
  const isProtectedPath = protectedPaths.some(path =>
    req.nextUrl.pathname.startsWith(path)
  )

  // Allow access to protected routes only if user has a session
  if (isProtectedPath && !req.auth) {
    const newUrl = new URL('/auth/signin', req.nextUrl.origin)
    return Response.redirect(newUrl)
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
