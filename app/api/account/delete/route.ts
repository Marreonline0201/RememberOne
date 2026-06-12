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

    for (const conn of connections ?? []) {
      let token: string | null = null;
      try {
        // Revoking the refresh token kills the whole grant; fall back to the
        // access token for rows that never stored one.
        token =
          decryptTokenOptional(conn.refresh_token) ??
          decryptTokenOptional(conn.access_token);
      } catch {
        continue; // corrupt/legacy blob — nothing to revoke
      }
      if (!token) continue;
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      }).catch(() => {});
    }
  } catch {
    // best-effort only
  }

  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account/delete] deleteUser failed:", error.message);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
