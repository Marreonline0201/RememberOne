// AI-consent helpers — App Store Guideline 5.1.2(i): the user must explicitly
// permit sending their personal content to a third-party AI (Google Gemini)
// BEFORE any such data leaves the app.
//
// Consent is stored on the user's auth metadata as `ai_consent_at` (an ISO
// timestamp; absent/null = not consented). Every AI route already calls
// supabase.auth.getUser() for auth, which returns the LIVE user record from
// GoTrue — so this read is free and never stale (no JWT-decode staleness). The
// client records it via supabase.auth.updateUser({ data: { ai_consent_at } })
// after the user agrees in the consent modal, and the next AI request sees it.
//
// This is the authoritative gate: enforcing it in every route (rather than only
// in the UI) guarantees no call site can slip an un-consented send past review.

import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

export function hasAiConsent(user: User | null | undefined): boolean {
  return Boolean(user?.user_metadata?.ai_consent_at);
}

// Standard short-circuit for AI routes when consent is missing. The client
// recognizes `error === "consent_required"` and opens the consent modal.
export function consentRequiredResponse(): NextResponse {
  return NextResponse.json(
    { data: null, error: "consent_required" },
    { status: 403 }
  );
}
