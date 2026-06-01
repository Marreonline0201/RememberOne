// POST /api/ai/translate-summary
// Translates a one-sentence meeting recap from whatever language it was
// stored in into the caller's currently-selected app language. The client
// caches the result in localStorage so subsequent language toggles for the
// same text are instant. Rides on the shared AI rate-limit bucket so a
// chatty client can't run up the Gemini bill.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { translateSummary } from "@/lib/gemini";
import { consumeAIRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Rate limit (shared per-user bucket)
    const rl = await consumeAIRateLimit(supabase);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          data: null,
          error: "Too many requests. Please wait a moment and try again.",
        },
        { status: 429, headers: rateLimitHeaders(rl) }
      );
    }

    // 3. Parse body
    let body: { text?: unknown; targetLang?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { data: null, error: "Invalid body" },
        { status: 400 }
      );
    }
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const targetLang = body?.targetLang === "ko" ? "ko" : "en";
    if (!text) {
      return NextResponse.json(
        { data: null, error: "Missing text" },
        { status: 400 }
      );
    }
    // 1000 chars is plenty for a one-sentence recap; reject anything larger
    // so a misuse can't pin Gemini on a giant blob.
    if (text.length > 1000) {
      return NextResponse.json(
        { data: null, error: "Text too long" },
        { status: 413 }
      );
    }

    // 4. Translate
    const translated = await translateSummary(text, targetLang);
    return NextResponse.json({ data: { translated }, error: null });
  } catch (err: unknown) {
    console.error("[/api/ai/translate-summary]", err);
    return NextResponse.json(
      { data: null, error: "Failed to translate" },
      { status: 500 }
    );
  }
}
