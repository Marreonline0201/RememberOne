// Supabase email confirmation callback
// Supabase redirects here after the user clicks their confirmation email

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Only allow path-relative redirects that can't escape the current origin.
// Blocks open-redirect shapes: "//evil.com", "/\\evil.com", "http://...", etc.
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to the login page with an error message
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate`);
}
