// POST /api/calendar/exchange
// Native-only counterpart to /api/calendar/callback. On native, Google's OAuth
// redirect re-enters the app via the verified /auth/callback app link (handled
// in the WebView), NOT this server route — so the WebView posts the auth `code`
// here to finish the flow. Because this runs as a WebView request it carries
// the app session (user) AND the oauth_state cookie (CSRF), so it stays exactly
// as secure as the web callback: user is derived from the session, never the URL.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/google-calendar";
import { encryptToken, encryptTokenOptional } from "@/lib/crypto";

// Must match the redirect_uri used to build the auth URL in /api/calendar/connect
// (native mode) and be a registered redirect URI on the Google OAuth client.
const NATIVE_REDIRECT_URI = "https://rememberone.online/auth/callback";

export async function POST(request: NextRequest) {
  let body: { code?: string; state?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { code, state } = body;
  if (!code || !state) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  // CSRF: the posted state must match the httpOnly cookie set in /connect.
  const expectedState = request.cookies.get("oauth_state")?.value;
  if (!expectedState || expectedState !== state) {
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  }

  // Authorization: target user comes from the session, not the request body.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const tokens = await exchangeCodeForTokens(code, NATIVE_REDIRECT_URI);

    const { error: dbError } = await supabase.from("calendar_connections").upsert(
      {
        user_id: user.id,
        provider: "google",
        access_token: encryptToken(tokens.access_token),
        refresh_token: encryptTokenOptional(tokens.refresh_token),
        token_expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        scope: tokens.scope,
        calendar_id: "primary",
      },
      { onConflict: "user_id,provider" }
    );

    if (dbError) throw new Error(dbError.message);

    const response = NextResponse.json({ success: true });
    response.cookies.delete("oauth_state"); // single-use
    return response;
  } catch (err: unknown) {
    console.error("[/api/calendar/exchange]", err);
    return NextResponse.json({ error: "token_exchange_failed" }, { status: 500 });
  }
}
