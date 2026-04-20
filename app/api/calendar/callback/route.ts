// GET /api/calendar/callback
// Google redirects here after the user grants (or denies) calendar access.
// Exchanges the authorization code for tokens and saves them to Supabase,
// scoped to the *authenticated* user — never a URL-supplied identifier.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/google-calendar";
import { encryptToken, encryptTokenOptional } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (oauthError) {
    return NextResponse.redirect(
      `${appUrl}/?calendar_error=${encodeURIComponent(oauthError)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/?calendar_error=missing_params`);
  }

  // CSRF: the `state` in the query string must match the httpOnly cookie
  // we set in /api/calendar/connect.
  const expectedState = request.cookies.get("oauth_state")?.value;
  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(`${appUrl}/?calendar_error=invalid_state`);
  }

  // Authorization: derive the target user from the authenticated session,
  // not from the URL. This is what prevents cross-user token poisoning.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login?calendar_error=session_expired`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

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

    const response = NextResponse.redirect(`${appUrl}/?calendar_connected=true`);
    // Single-use CSRF token: clear the cookie once consumed.
    response.cookies.delete("oauth_state");
    return response;
  } catch (err: unknown) {
    console.error("[/api/calendar/callback]", err);
    return NextResponse.redirect(`${appUrl}/?calendar_error=token_exchange_failed`);
  }
}
