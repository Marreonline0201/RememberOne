// POST /api/apple/notifications — Sign in with Apple server-to-server
// notification endpoint (required for Korea-based developers when the
// Services ID is registered/updated, Apple developer news j9zukcr6).
//
// Apple POSTs { payload: <JWS> } signed RS256 with its public keys. We verify
// the signature against Apple's JWKS, then act on the events that matter:
//   - account-delete / consent-revoked → delete the matching RememberOne
//     account (the user severed the app's authorization at the Apple level,
//     which is the strongest possible deletion signal).
//   - email-disabled/enabled → logged only (we don't email users today).
// Always answers 200 quickly; Apple retries on failures.

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

const APPLE_ISS = "https://appleid.apple.com";
const OUR_CLIENT_IDS = new Set(["com.rememberone.app", "com.rememberone.web"]);

const b64u = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

async function verifyAppleJws(jws: string): Promise<Record<string, unknown> | null> {
  const parts = jws.split(".");
  if (parts.length !== 3) return null;
  const header = JSON.parse(b64u(parts[0]).toString()) as { kid?: string; alg?: string };
  if (header.alg !== "RS256" || !header.kid) return null;

  const jwksRes = await fetch("https://appleid.apple.com/auth/keys", {
    signal: AbortSignal.timeout(8000),
  });
  if (!jwksRes.ok) throw new Error(`jwks fetch ${jwksRes.status}`);
  const { keys } = (await jwksRes.json()) as { keys: Array<Record<string, string>> };
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;

  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const ok = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    b64u(parts[2])
  );
  if (!ok) return null;

  const claims = JSON.parse(b64u(parts[1]).toString()) as Record<string, unknown>;
  if (claims.iss !== APPLE_ISS) return null;
  if (typeof claims.aud !== "string" || !OUR_CLIENT_IDS.has(claims.aud)) return null;
  return claims;
}

async function findUserByAppleSub(sub: string): Promise<string | null> {
  const service = createServiceClient();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      if (u.identities?.some((i) => i.provider === "apple" && i.id === sub)) {
        return u.id;
      }
    }
    if (data.users.length < 200) break;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { payload?: string } | null;
    if (!body?.payload || typeof body.payload !== "string") {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const claims = await verifyAppleJws(body.payload);
    if (!claims) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
    }

    // `events` arrives as a JSON string per Apple's spec.
    const events =
      typeof claims.events === "string"
        ? (JSON.parse(claims.events) as { type?: string; sub?: string })
        : (claims.events as { type?: string; sub?: string } | undefined);
    const type = events?.type;
    const sub = events?.sub;
    console.log(`[apple/notifications] event=${type ?? "?"}`);

    if (sub && (type === "account-delete" || type === "consent-revoked")) {
      const userId = await findUserByAppleSub(sub);
      if (userId) {
        const service = createServiceClient();
        const { error } = await service.auth.admin.deleteUser(userId);
        if (error) {
          console.error("[apple/notifications] delete failed:", error.message);
        } else {
          console.log(`[apple/notifications] deleted user for ${type}`);
        }
      } else {
        console.log("[apple/notifications] no matching user for event sub");
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(
      "[apple/notifications] error:",
      err instanceof Error ? err.message : err
    );
    // 200 would suppress Apple retries; 500 lets Apple retry transient faults.
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
