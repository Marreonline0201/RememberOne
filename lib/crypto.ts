// Server-only. AES-256-GCM for encrypting small secrets at rest
// (Google Calendar access / refresh tokens).
//
// Ciphertext format:  v1:<iv-b64>:<ct-b64>:<tag-b64>
// - version prefix so keys/algorithms can rotate without ambiguity.
// - `decryptToken` returns the input unchanged when it doesn't start with
//   the current version prefix, so legacy plaintext rows keep working
//   until they're rewritten by a normal refresh cycle.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const secret = process.env.TOKEN_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "TOKEN_ENCRYPTION_SECRET env var is not set. Generate one with " +
        "`node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"` " +
        "and add it to .env.local + Vercel project env."
    );
  }

  // Accept base64 (preferred) or hex.
  const asBase64 = Buffer.from(secret, "base64");
  if (asBase64.length === 32) {
    cachedKey = asBase64;
    return cachedKey;
  }
  const asHex = Buffer.from(secret, "hex");
  if (asHex.length === 32) {
    cachedKey = asHex;
    return cachedKey;
  }
  throw new Error(
    "TOKEN_ENCRYPTION_SECRET must decode to exactly 32 bytes (base64 or hex)."
  );
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    ct.toString("base64"),
    tag.toString("base64"),
  ].join(":");
}

export function decryptToken(blob: string): string {
  // Legacy plaintext row (pre-encryption deploy) — pass through.
  if (!blob.startsWith(`${VERSION}:`)) return blob;

  const [, ivB64, ctB64, tagB64] = blob.split(":");
  if (!ivB64 || !ctB64 || !tagB64) {
    throw new Error("Malformed ciphertext");
  }

  const key = getKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

export function encryptTokenOptional(
  plaintext: string | null | undefined
): string | null {
  return plaintext ? encryptToken(plaintext) : null;
}

export function decryptTokenOptional(
  blob: string | null | undefined
): string | null {
  return blob ? decryptToken(blob) : null;
}
