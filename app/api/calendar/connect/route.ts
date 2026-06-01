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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Native (Capacitor) clients can't open Google's OAuth page inside the
  // WebView — Google's "use secure browsers" policy blocks it
  // (disallowed_useragent). So the app calls this with ?mode=native, opens the
  // returned URL in Chrome Custom Tabs, and Google redirects back through the
  // verified /auth/callback app link. The token exchange then happens in
  // /api/calendar/exchange (called from the WebView, which has the session).
  const isNative = request.nextUrl.searchParams.get("mode") === "native";

  if (!user) {
    return isNative
      ? NextResponse.json({ error: "unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url));
  }

  // Native returns must re-enter the app via the only verified Android App
  // Link (/auth/callback); the "cal_" prefix lets the app's appUrlOpen handler
  // tell a calendar return apart from a Supabase login return.
  const state = (isNative ? "cal_" : "") + randomBytes(32).toString("hex");

  // Web: derive the callback from the request (works on previews/localhost).
  // Native: must be the registered app-link HTTPS URL.
  const redirectUri = isNative
    ? "https://rememberone.online/auth/callback"
    : new URL("/api/calendar/callback", request.url).toString();

  const authUrl = getAuthUrl(state, redirectUri);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };

  // CSRF state cookie is set on the WebView (this request) and verified by the
  // same WebView on /api/calendar/exchange — the Custom Tab never needs it.
  const response = isNative
    ? NextResponse.json({ url: authUrl })
    : NextResponse.redirect(authUrl);
  response.cookies.set("oauth_state", state, cookieOptions);
  return response;
}
