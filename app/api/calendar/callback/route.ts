// GET /api/calendar/callback
// Google redirects here after the user grants (or denies) calendar access.
// Exchanges the authorization code for tokens and saves them to Supabase.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // User denied access
  if (error) {
    return NextResponse.redirect(`${appUrl}/?calendar_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/?calendar_error=missing_params`);
  }

  // Decode state to get userId
  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
    userId = decoded.userId;
    if (!userId) throw new Error("No userId in state");
  } catch {
    return NextResponse.redirect(`${appUrl}/?calendar_error=invalid_state`);
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Use service client to write tokens (callback has no session cookie)
    const supabase = createServiceClient();

    await supabase.from("calendar_connections").upsert(
      {
        user_id: userId,
        provider: "google",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        scope: tokens.scope,
        calendar_id: "primary",
      },
      { onConflict: "user_id,provider" }
    );

    return NextResponse.redirect(`${appUrl}/?calendar_connected=true`);
  } catch (err: unknown) {
    console.error("[/api/calendar/callback]", err);
    return NextResponse.redirect(`${appUrl}/?calendar_error=token_exchange_failed`);
  }
}
