// GET /api/calendar/connect
// Initiates Google OAuth flow — redirects user to Google's consent screen

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

  // Generate a CSRF state token that encodes the user ID
  // We encode userId in state so the callback can identify the user
  // In production you'd store state in a short-lived DB entry or signed JWT
  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ userId: user.id, nonce })).toString("base64url");

  const authUrl = getAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
