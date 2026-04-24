// Supabase Auth Middleware
// Refreshes the user session on every request and redirects
// unauthenticated users away from protected routes

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — this is required per @supabase/ssr docs
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public paths that do not require authentication.
  // /privacy, /child-safety, /account-deletion must be reachable without
  // signing in per Google Play's Data Safety / policy-page requirements.
  // /.well-known must be reachable without signing in so Google's App Links
  // crawler can fetch /.well-known/assetlinks.json to verify the Android
  // package ↔ domain binding (P1-02).
  const publicPaths = [
    "/login",
    "/auth/callback",
    "/privacy",
    "/child-safety",
    "/account-deletion",
    "/.well-known",
  ];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  // Redirect unauthenticated users to /login (return 401 for API routes)
  if (!user && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from /login
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
