// /api/account/delete — permanently delete the signed-in user's account.
//
// Required for the app stores (Apple guideline 5.1.1(v): apps with account
// creation must let users initiate full account deletion in-app; Google Play
// has the equivalent data-deletion policy).
//
// Deletion is immediate and complete: removing the auth.users row cascades
// through every user table (profiles → people → meetings / person_attributes /
// family_members → family_member_attributes, plus calendar_connections and
// ai_rate_limits — all FKs are ON DELETE CASCADE). Before that, we best-effort
// revoke any Google Calendar OAuth grant so the app doesn't linger with live
// access in the user's Google account after their RememberOne account is gone.

import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { decryptTokenOptional } from "@/lib/crypto";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Best-effort Google token revocation. Failures (already revoked, network,
  // undecryptable legacy rows) never block the deletion itself.
  try {
    const { data: connections } = await supabase
      .from("calendar_connections")
      .select("access_token, refresh_token")
      .eq("user_id", user.id);

    // Revoking the refresh token kills the whole grant; fall back to the
    // access token for rows that never stored one. Each decrypt gets its own
    // try/catch so one corrupt blob doesn't skip a usable fallback.
    const tryDecrypt = (blob: string | null): string | null => {
      try {
        return decryptTokenOptional(blob);
      } catch {
        return null;
      }
    };
    for (const conn of connections ?? []) {
      const token =
        tryDecrypt(conn.refresh_token) ?? tryDecrypt(conn.access_token);
      if (!token) continue;
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
        // A hung revoke must never eat the function time limit and block the
        // deletion itself — that would invert the "best-effort" intent.
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    }
  } catch {
    // best-effort only
  }

  const service = createServiceClient();

  // Best-effort Apple grant revocation (native Sign in with Apple users whose
  // refresh token we captured at sign-in). Apple's account-deletion guidance
  // asks for this; failures never block the deletion.
  try {
    const clientSecret = process.env.APPLE_NATIVE_CLIENT_SECRET;
    if (clientSecret) {
      const { data: appleRow } = await service
        .from("apple_tokens")
        .select("refresh_token")
        .eq("user_id", user.id)
        .maybeSingle();
      const appleToken = appleRow
        ? (() => {
            try {
              return decryptTokenOptional(appleRow.refresh_token);
            } catch {
              return null;
            }
          })()
        : null;
      if (appleToken) {
        await fetch("https://appleid.apple.com/auth/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: "com.rememberone.app",
            client_secret: clientSecret,
            token: appleToken,
            token_type_hint: "refresh_token",
          }),
          signal: AbortSignal.timeout(5000),
        }).catch(() => {});
      }
    }
  } catch {
    // best-effort only
  }

  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account/delete] deleteUser failed:", error.message);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
