// POST /api/ai/transcribe
// Accepts a recorded audio blob (multipart form field "audio") and returns
// a verbatim transcript via Gemini. The mic-recording flow on the client uses
// MediaRecorder for continuous capture (no mid-sentence cutoffs) and posts
// the resulting blob here on stop.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/gemini";
import { consumeAIRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

// 5 MB ≈ 8 minutes of Opus-encoded WebM. Comfortably above the 60-second cap
// the client enforces, with room for higher-bitrate codecs.
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

// Defense in depth: extension/codec families we know Gemini accepts directly
// or via the lib/gemini.ts normalizer. Anything else gets rejected up-front.
const ALLOWED_MIME_PREFIXES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/mp3",
  "audio/mpeg",
];

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

    // 2. Rate limit (shares the same per-user sliding window as /api/ai/extract)
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

    // 3. Pull the audio out of multipart form-data
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { data: null, error: "Invalid form data" },
        { status: 400 }
      );
    }
    const file = form.get("audio");
    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { data: null, error: "Missing audio file" },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json(
        { data: null, error: "Audio is empty" },
        { status: 400 }
      );
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { data: null, error: "Audio too large (max 5 MB)" },
        { status: 413 }
      );
    }

    const rawMime = (file.type || "audio/webm").toLowerCase();
    const allowed = ALLOWED_MIME_PREFIXES.some((p) => rawMime.startsWith(p));
    if (!allowed) {
      return NextResponse.json(
        { data: null, error: "Unsupported audio format" },
        { status: 415 }
      );
    }

    // 4. Convert to base64 (Gemini SDK accepts inlineData as base64 string)
    const arrayBuffer = await file.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString("base64");

    // 5. Pick language from the user's profile metadata
    const lang = (user.user_metadata?.language === "ko" ? "ko" : "en") as
      | "en"
      | "ko";

    // 6. Optional polish flag — when "true" Gemini fixes grammar/punctuation
    //    while keeping the speaker's content intact. Used by the Notes voice
    //    button. Default (false) keeps the verbatim flow that the AI extractor
    //    on /meet still relies on.
    const polish = form.get("polish") === "true";

    // 7. Transcribe
    const text = await transcribeAudio(audioBase64, rawMime, lang, polish);

    return NextResponse.json({ data: { text }, error: null });
  } catch (err: unknown) {
    console.error("[/api/ai/transcribe]", err);
    return NextResponse.json(
      { data: null, error: "Failed to transcribe" },
      { status: 500 }
    );
  }
}
