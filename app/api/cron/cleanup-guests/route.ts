// Weekly cron: purge stale GUEST (anonymous) accounts and, via FK cascades,
// every note they stored. Privacy hygiene promised in the privacy policy:
// guests hold personal notes about real people behind a session token that
// lives on one device — once that token is gone the data is orphaned, so
// anything untouched for 60 days gets deleted outright.
//
// Invoked by Vercel Cron (vercel.json). Protected by CRON_SECRET; supports
// ?dry=1 to report what WOULD be deleted without deleting.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const STALE_DAYS = 60;
const PAGE_SIZE = 200;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get("dry") === "1";

  const service = createServiceClient();
  const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
  const stale: string[] = [];

  // Walk all users; guest accounts are flagged is_anonymous. The user base is
  // small; pagination keeps this safe as it grows.
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (error) {
      console.error("[cleanup-guests] listUsers failed:", error.message);
      return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
    for (const u of data.users) {
      if (!u.is_anonymous) continue;
      const lastSeen = Date.parse(u.last_sign_in_at ?? u.created_at ?? "");
      if (Number.isFinite(lastSeen) && lastSeen < cutoff) stale.push(u.id);
    }
    if (data.users.length < PAGE_SIZE) break;
  }

  let deleted = 0;
  if (!dry) {
    for (const id of stale) {
      const { error } = await service.auth.admin.deleteUser(id);
      if (error) console.error(`[cleanup-guests] delete ${id} failed:`, error.message);
      else deleted++;
    }
  }

  console.log(
    `[cleanup-guests] stale=${stale.length} deleted=${deleted} dry=${dry}`
  );
  return NextResponse.json({ stale: stale.length, deleted, dry });
}
