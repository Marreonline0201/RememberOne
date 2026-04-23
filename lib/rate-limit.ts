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

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** ISO timestamp at which the current window ends. */
  resetAt: string;
}

export async function consumeAIRateLimit(
  supabase: SupabaseClient
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.rpc("consume_ai_rate_limit", {
      p_max_requests: AI_RATE_LIMIT.maxRequests,
      p_window_seconds: AI_RATE_LIMIT.windowSeconds,
    });

    if (error) throw new Error(error.message);

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("rate-limit RPC returned no row");

    return {
      allowed: Boolean(row.allowed),
      remaining: Number(row.remaining),
      resetAt: String(row.reset_at),
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
    };
  }
}

/** Build standard rate-limit response headers for a 429 reply. */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  const retryAfterSec = Math.max(
    1,
    Math.ceil((new Date(result.resetAt).getTime() - Date.now()) / 1000)
  );
  return {
    "X-RateLimit-Limit": String(AI_RATE_LIMIT.maxRequests),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "X-RateLimit-Reset": result.resetAt,
    "Retry-After": String(retryAfterSec),
  };
}
