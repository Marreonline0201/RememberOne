// POST /api/apple/store-token — called fire-and-forget right after a NATIVE
// Sign in with Apple succeeds. Exchanges the one-shot authorization code for
// an Apple refresh token and stores it (encrypted) so account deletion can
// revoke the Apple grant (App Store 5.1.1(v)).
//
// Everything here is best-effort: a failure must never surface to the login
// flow, so the route answers 200 with { stored: false } on any soft failure.
// Requires APPLE_NATIVE_CLIENT_SECRET (ES256 JWT with sub=com.rememberone.app,
// same signing key as the Supabase web secret).

import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/crypto";
import { z } from "zod";

const APPLE_NATIVE_CLIENT_ID = "com.rememberone.app";

const RequestSchema = z.object({
  authorizationCode: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const clientSecret = process.env.APPLE_NATIVE_CLIENT_SECRET;
  if (!clientSecret) {
    console.warn("[apple/store-token] APPLE_NATIVE_CLIENT_SECRET not set");
    return NextResponse.json({ stored: false });
  }

  try {
    const res = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: parsed.data.authorizationCode,
        client_id: APPLE_NATIVE_CLIENT_ID,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn("[apple/store-token] exchange failed:", res.status, await res.text());
      return NextResponse.json({ stored: false });
    }
    const json = (await res.json()) as { refresh_token?: string };
    if (!json.refresh_token) {
      console.warn("[apple/store-token] no refresh_token in exchange response");
      return NextResponse.json({ stored: false });
    }

    // Service client: apple_tokens has RLS with no policies on purpose.
    const service = createServiceClient();
    const { error } = await service.from("apple_tokens").upsert({
      user_id: user.id,
      refresh_token: encryptToken(json.refresh_token),
    });
    if (error) {
      console.warn("[apple/store-token] upsert failed:", error.message);
      return NextResponse.json({ stored: false });
    }
    return NextResponse.json({ stored: true });
  } catch (err) {
    console.warn(
      "[apple/store-token] error:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ stored: false });
  }
}
