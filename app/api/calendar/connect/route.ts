// GET /api/calendar/connect
// Initiates Google OAuth flow — redirects user to Google's consent screen.
//
// CSRF: we mint a random `state` and bind it to the caller's browser via an
// httpOnly cookie. `/api/calendar/callback` verifies the returned `state`
// matches the cookie before exchanging the code.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/google-calendar";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = randomBytes(32).toString("hex");

  const response = NextResponse.redirect(getAuthUrl(state));
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
