// Rate limit wrapper for AI endpoints.
// Backed by a Postgres function (`consume_ai_rate_limit`) that atomically
// bumps a per-user counter and tells us whether the caller may proceed.
//
// Tuning knobs are defined here, not in SQL, so changes are a code review
// instead of a migration.

import type { SupabaseClient } from "@supabase/supabase-js";

export const AI_RATE_LIMIT = {
  maxRequests: 30,
  windowSeconds: 600, // 10 min
} as const;

// Anonymous (guest) accounts get a small LIFETIME budget instead of a rolling
// window: enough to genuinely try the AI features, small enough that minting
// fresh guests is a useless abuse vector. The 10-year window makes the same
// atomic RPC behave as a lifetime counter — a given user id is always either
// a guest or a full account, so its counter row only ever sees one param set
// (converting a guest keeps the id, which also keeps any spent budget until
// the window rolls — acceptable, since converts get the 30/10-min budget).
export const GUEST_AI_LIMIT = {
  maxRequests: 10,
  windowSeconds: 315_360_000, // ~10 years
} as const;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** ISO timestamp at which the current window ends. */
  resetAt: string;
  /** True when the guest lifetime budget was applied. */
  guest: boolean;
  /** The max-requests ceiling that was applied (for headers). */
  limit: number;
}

export async function consumeAIRateLimit(
  supabase: SupabaseClient,
  user?: { is_anonymous?: boolean } | null
): Promise<RateLimitResult> {
  const guest = Boolean(user?.is_anonymous);
  const limits = guest ? GUEST_AI_LIMIT : AI_RATE_LIMIT;
  try {
    const { data, error } = await supabase.rpc("consume_ai_rate_limit", {
      p_max_requests: limits.maxRequests,
      p_window_seconds: limits.windowSeconds,
    });

    if (error) throw new Error(error.message);

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("rate-limit RPC returned no row");

    return {
      allowed: Boolean(row.allowed),
      remaining: Number(row.remaining),
      resetAt: String(row.reset_at),
      guest,
      limit: limits.maxRequests,
    };
  } catch (err) {
    // Fail open: if the Postgres function doesn't exist yet, or the RPC
    // fails transiently, we'd rather allow the request than break the app.
    // The only moment this matters is between merging the code and running
    // the SQL migration. Warning logged so that state is visible.
    console.warn(
      "[rate-limit] consume_ai_rate_limit failed, failing open:",
      err instanceof Error ? err.message : err
    );
    return {
      allowed: true,
      remaining: -1,
      resetAt: new Date().toISOString(),
      guest,
      limit: limits.maxRequests,
    };
  }
}

/** User-facing message for a 429 — guests are pointed at account creation. */
export function rateLimitMessage(result: RateLimitResult): string {
  return result.guest
    ? "Guest limit reached. Create a free account in Settings to keep using AI features."
    : "Too many requests. Please wait a moment and try again.";
}

/** Build standard rate-limit response headers for a 429 reply. */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  const retryAfterSec = Math.max(
    1,
    Math.ceil((new Date(result.resetAt).getTime() - Date.now()) / 1000)
  );
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "X-RateLimit-Reset": result.resetAt,
    "Retry-After": String(retryAfterSec),
  };
}
